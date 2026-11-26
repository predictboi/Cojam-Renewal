import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePrivy, useWallets, useLoginWithEmail, useCreateWallet, useSendTransaction, type ConnectedWallet } from '@privy-io/react-auth';
import { JsonRpcProvider, Wallet, formatEther, parseEther, toBeHex, hexlify, randomBytes } from 'ethers';
import { CONFIG } from './config.ts';
import { readEnv, type EnvInfo } from './lib/env.ts';
import { getBalance, waitReceipt } from './lib/rpc.ts';
import { localSigner, newMarketBase, playKeyBurst, predictData, readPlayer, setPlayKeyData, signSponsorMine, txUrl, type Ctx, type HashSigner } from './lib/flow.ts';
import { toKaiaSignature } from './lib/kaiaTx.ts';
import { saveKey, loadKeyRecord, decryptKey, deleteKey, markAuthorised, type StoredKey } from './lib/playKeyStore.ts';
import { getLines, subscribe } from './lib/consoleCapture.ts';

type Status = 'idle' | 'running' | 'ok' | 'error';
type Prompt = 'yes' | 'no' | null;
interface Link {
  label: string;
  hash: string;
}
interface StepState {
  status: Status;
  ms?: number;
  result?: unknown;
  error?: string;
  links?: Link[];
  prompt?: Prompt;
}
type StepKey = 'a' | 'b' | 'c' | 'c2' | 'd' | 'e' | 'f';

const ctx: Ctx = { rpcUrl: CONFIG.rpcUrl, apiBase: CONFIG.apiBase, chainId: CONFIG.chainId, contract: CONFIG.contract };
const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* storage blocked */
    }
  },
};

// Launch bookkeeping, read once per app start (cold start).
const launch = (() => {
  const count = Number(ls.get('spike.launchCount') || '0') + 1;
  const previous = ls.get('spike.lastLaunchAt');
  ls.set('spike.launchCount', String(count));
  ls.set('spike.lastLaunchAt', new Date().toISOString());
  return { count, previousLaunchAt: previous, wasLoggedInLastTime: ls.get('spike.loggedIn') === '1', startedAt: new Date().toISOString() };
})();

function errText(e: unknown): string {
  if (e instanceof Error) {
    const code = (e as { code?: unknown }).code;
    const extra = (e as { txHash?: string }).txHash ? ` (tx ${(e as { txHash?: string }).txHash})` : '';
    return `${e.name}: ${e.message}${code !== undefined && !String(e.message).startsWith(String(code)) ? ` [code ${String(code)}]` : ''}${extra}`;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x), 2);
const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

// ---------------------------------------------------------------- dev key (localhost only)

function devWallet(): Wallet | null {
  if (!CONFIG.devKey) return null;
  let pk: string | null = null;
  try {
    pk = sessionStorage.getItem('spike.devkey');
    if (!pk) {
      pk = Wallet.createRandom().privateKey;
      sessionStorage.setItem('spike.devkey', pk);
    }
  } catch {
    pk = Wallet.createRandom().privateKey;
  }
  return new Wallet(pk);
}

// ---------------------------------------------------------------- UI pieces

function StepCard(props: {
  id: string;
  title: string;
  hint?: ReactNode;
  state: StepState;
  children?: ReactNode;
  askPrompt?: boolean;
  onPrompt?: (p: Prompt) => void;
}) {
  const { state } = props;
  return (
    <section className={`step step-${state.status}`} aria-labelledby={`h-${props.id}`}>
      <header className="step-head">
        <span className="step-id">{props.id}</span>
        <h2 id={`h-${props.id}`}>{props.title}</h2>
        <span className={`badge badge-${state.status}`}>{state.status === 'running' ? 'running' : state.status === 'ok' ? 'ok' : state.status === 'error' ? 'error' : 'not run'}</span>
      </header>
      {props.hint && <p className="hint">{props.hint}</p>}
      <div className="actions">{props.children}</div>
      {state.ms !== undefined && <p className="ms">{state.ms.toLocaleString()} ms</p>}
      {state.error && (
        <pre className="error" role="alert">
          {state.error}
        </pre>
      )}
      {state.links && state.links.length > 0 && (
        <ul className="links">
          {state.links.map((l) => (
            <li key={l.hash}>
              {l.label}:{' '}
              <a href={txUrl(l.hash)} target="_blank" rel="noreferrer">
                {short(l.hash)}
              </a>
            </li>
          ))}
        </ul>
      )}
      {state.result !== undefined && (
        <details className="result" open={state.status === 'ok' && props.id !== 'a'}>
          <summary>Result</summary>
          <pre>{json(state.result)}</pre>
        </details>
      )}
      {props.askPrompt && (
        <fieldset className="prompt">
          <legend>Did a Privy window or prompt appear during this step?</legend>
          {(['no', 'yes'] as const).map((p) => (
            <label key={p}>
              <input type="radio" name={`prompt-${props.id}`} checked={state.prompt === p} onChange={() => props.onPrompt?.(p)} /> {p === 'yes' ? 'Yes' : 'No'}
            </label>
          ))}
        </fieldset>
      )}
    </section>
  );
}

function Btn(props: { onClick: () => void; disabled?: boolean; children: ReactNode; kind?: 'primary' | 'plain' | 'danger' }) {
  return (
    <button type="button" className={`btn btn-${props.kind || 'primary'}`} onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  );
}

// ---------------------------------------------------------------- the app

export function App() {
  const dev = useMemo(devWallet, []);
  const { ready, authenticated, user, logout, login } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  const { sendTransaction } = useSendTransaction();
  const emailFlow = useLoginWithEmail();

  const [steps, setSteps] = useState<Record<StepKey, StepState>>({
    a: { status: 'idle' },
    b: { status: 'idle' },
    c: { status: 'idle' },
    c2: { status: 'idle' },
    d: { status: 'idle' },
    e: { status: 'idle' },
    f: { status: 'idle' },
  });
  const patch = useCallback((k: StepKey, s: Partial<StepState>) => setSteps((p) => ({ ...p, [k]: { ...p[k], ...s } })), []);

  const [env, setEnv] = useState<EnvInfo | null>(null);
  const [health, setHealth] = useState<{ ok: boolean; text: string; feePayer?: string }>({ ok: false, text: 'checking…' });
  const [email, setEmail] = useState(ls.get('spike.pendingEmail') || '');
  const [code, setCode] = useState('');
  const [codeSentAt, setCodeSentAt] = useState<string | null>(ls.get('spike.codeSentAt'));
  const [keyRec, setKeyRec] = useState<StoredKey | null | undefined>(undefined);
  const [keyOnLaunch, setKeyOnLaunch] = useState<{ found: boolean; address?: string; createdAt?: string; error?: string } | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const loginTimes = useRef<Record<string, number>>({});
  const walletCreation = useRef<string | null>(null);
  const consoleLines = useSyncExternalStore(subscribe, getLines);

  const embedded: ConnectedWallet | undefined = wallets.find((w) => w.walletClientType === 'privy');
  const playerAddress = dev ? dev.address : embedded?.address;

  // a: read the environment at start (without asking for persistence yet)
  useEffect(() => {
    readEnv(false).then((e) => {
      setEnv(e);
      patch('a', { status: 'ok', result: e });
    });
  }, [patch]);

  // API health
  useEffect(() => {
    if (!CONFIG.apiBase) {
      setHealth({ ok: false, text: 'No fee payer URL configured (VITE_SPONSOR_API)' });
      return;
    }
    fetch(`${CONFIG.apiBase}/health`)
      .then((r) => r.json())
      .then((h) => setHealth({ ok: !h.degraded, text: `chain ${h.chainId}, fee payer ${short(h.feePayer?.address)} holds ${Number(h.feePayer?.balanceKaia).toFixed(3)} KAIA${h.degraded ? ' (degraded)' : ''}`, feePayer: h.feePayer?.address }))
      .catch((e) => setHealth({ ok: false, text: `Fee payer unreachable at ${CONFIG.apiBase}: ${errText(e)}` }));
  }, []);

  // play key found on launch? (spike item 9)
  useEffect(() => {
    loadKeyRecord()
      .then((r) => {
        setKeyRec(r || null);
        setKeyOnLaunch(r ? { found: true, address: r.address, createdAt: r.createdAt } : { found: false });
      })
      .catch((e) => {
        setKeyRec(null);
        setKeyOnLaunch({ found: false, error: errText(e) });
      });
  }, []);

  // remember login state across launches (spike item 5: does the session survive closing the app)
  useEffect(() => {
    if (ready) ls.set('spike.loggedIn', authenticated ? '1' : '0');
  }, [ready, authenticated]);
  const sessionOnLaunch = useRef<boolean | null>(null);
  if (ready && sessionOnLaunch.current === null) sessionOnLaunch.current = authenticated;

  // headless email login does not create the embedded wallet: create it once if missing
  useEffect(() => {
    if (dev || !ready || !authenticated || !walletsReady || embedded || walletCreation.current) return;
    const t = setTimeout(() => {
      if (walletCreation.current || wallets.find((w) => w.walletClientType === 'privy')) return;
      walletCreation.current = 'createWallet() called by the app';
      const t0 = performance.now();
      createWallet()
        .then((w) => {
          loginTimes.current.createWalletMs = Math.round(performance.now() - t0);
          console.warn('embedded wallet created by createWallet()', w.address);
        })
        .catch((e) => {
          walletCreation.current = `createWallet() failed: ${errText(e)}`;
          patch('b', { status: 'error', error: `Embedded wallet creation failed: ${errText(e)}` });
        });
    }, 2500);
    return () => clearTimeout(t);
  }, [dev, ready, authenticated, walletsReady, embedded, wallets, createWallet, patch]);

  useEffect(() => {
    if (!dev && embedded && !walletCreation.current) walletCreation.current = 'present at login (existing or created by Privy)';
  }, [dev, embedded]);

  // b result summary
  useEffect(() => {
    if (dev) {
      patch('b', { status: 'ok', result: { mode: 'devkey (localhost only): Privy skipped', address: dev.address } });
      return;
    }
    if (!ready) return;
    if (authenticated) {
      const t = loginTimes.current;
      patch('b', {
        status: embedded ? 'ok' : 'running',
        ms: t.loginMs,
        error: undefined,
        result: {
          email: user?.email?.address ? user.email.address.replace(/^(.).*(@.*)$/, '$1***$2') : undefined,
          privyUserId: user?.id,
          embeddedWallet: embedded?.address || 'waiting for the embedded wallet…',
          walletCreation: walletCreation.current,
          timings: t,
          sessionRestoredOnLaunch: sessionOnLaunch.current === true,
        },
      });
    }
  }, [dev, ready, authenticated, embedded, user, patch]);

  useEffect(() => {
    if (playerAddress) getBalance(CONFIG.rpcUrl, playerAddress).then((b) => setBalance(formatEther(b))).catch(() => setBalance(null));
  }, [playerAddress, steps.f.status]);

  // ---------------------------------------------------------------- signers

  const playerSigner = useCallback(async (): Promise<HashSigner> => {
    if (dev) return localSigner(dev, 'dev key (stand in for Privy)');
    if (!embedded) throw new Error('Log in first: there is no Privy embedded wallet yet');
    const provider = await embedded.getEthereumProvider();
    return {
      address: embedded.address,
      label: 'Privy embedded wallet',
      signHash: async (hash) => {
        // Privy React SDK: raw hash signing through the embedded wallet's EIP-1193 provider.
        // This method has no confirmation UI path in the SDK (it goes straight to the wallet).
        const out = await provider.request({ method: 'secp256k1_sign', params: [hash] });
        return out as string;
      },
    };
  }, [dev, embedded]);

  const run = useCallback(
    async (k: StepKey, fn: () => Promise<{ result: unknown; links?: Link[] }>) => {
      patch(k, { status: 'running', error: undefined, result: undefined, links: undefined, ms: undefined });
      const t0 = performance.now();
      try {
        const out = await fn();
        patch(k, { status: 'ok', ms: Math.round(performance.now() - t0), result: out.result, links: out.links });
      } catch (e) {
        const mined = (e as { mined?: { txHash: string } }).mined;
        patch(k, {
          status: 'error',
          ms: Math.round(performance.now() - t0),
          error: errText(e),
          links: mined ? [{ label: 'reverted tx', hash: mined.txHash }] : (e as { txHash?: string }).txHash ? [{ label: 'tx', hash: (e as { txHash: string }).txHash }] : undefined,
        });
      }
    },
    [patch]
  );

  // ---------------------------------------------------------------- actions

  const stepA = () =>
    run('a', async () => {
      const e = await readEnv(true);
      setEnv(e);
      return { result: e };
    });

  const sendCode = () =>
    run('b', async () => {
      const t0 = performance.now();
      await emailFlow.sendCode({ email: email.trim() });
      loginTimes.current.sendCodeMs = Math.round(performance.now() - t0);
      const at = new Date().toISOString();
      ls.set('spike.pendingEmail', email.trim());
      ls.set('spike.codeSentAt', at);
      setCodeSentAt(at);
      return { result: { codeSentTo: email.trim(), at, sendCodeMs: loginTimes.current.sendCodeMs, note: 'Open Mail, copy the code, come back and enter it.' } };
    });

  const submitCode = () =>
    run('b', async () => {
      const t0 = performance.now();
      await emailFlow.loginWithCode({ code: code.trim() });
      loginTimes.current.loginWithCodeMs = Math.round(performance.now() - t0);
      loginTimes.current.loginMs = loginTimes.current.loginWithCodeMs;
      if (codeSentAt) loginTimes.current.secondsFromCodeSentToLogin = Math.round((Date.now() - Date.parse(codeSentAt)) / 1000);
      loginTimes.current.codeLength = code.trim().length;
      ls.set('spike.pendingEmail', null);
      ls.set('spike.codeSentAt', null);
      setCodeSentAt(null);
      return { result: { loggedIn: true, codeLength: code.trim().length, timings: loginTimes.current } };
    });

  const modalLogin = () => {
    loginTimes.current.modalOpenedAt = Date.now();
    login({ loginMethods: ['email'] });
  };

  const doLogout = () =>
    run('b', async () => {
      await logout();
      walletCreation.current = null;
      return { result: { loggedOut: true } };
    });

  const ensurePlayKey = async (): Promise<{ wallet: Wallet; rec: StoredKey; created: boolean }> => {
    let rec = await loadKeyRecord();
    let created = false;
    if (!rec) {
      const w = Wallet.createRandom();
      await saveKey(w.address, w.privateKey);
      rec = (await loadKeyRecord())!;
      created = true;
      try {
        await navigator.storage?.persist?.();
      } catch {
        /* recorded in step a */
      }
    }
    const pk = await decryptKey(rec);
    const wallet = new Wallet(pk);
    if (wallet.address !== rec.address) throw new Error('Stored play key does not match its address');
    setKeyRec(rec);
    return { wallet, rec, created };
  };

  const stepC = () =>
    run('c', async () => {
      const signer = await playerSigner();
      const { wallet: key, created } = await ensurePlayKey();
      const expiresAt = Math.floor(Date.now() / 1000) + 30 * 86400;
      const m = await signSponsorMine(ctx, signer, 'setPlayKey', setPlayKeyData(key.address, expiresAt));
      await markAuthorised(m.txHash, expiresAt);
      setKeyRec((await loadKeyRecord()) || null);
      return {
        links: [{ label: 'setPlayKey', hash: m.txHash }],
        result: {
          signer: signer.label,
          player: signer.address,
          playKey: key.address,
          playKeyCreatedNow: created,
          expiresAt,
          sigHash: m.sigHash,
          signatureReturned: m.signature.returned,
          signatureBytes: m.signature.byteLength,
          vReturned: m.signature.vReturned,
          conversion: m.signature.conversion,
          signMs: m.signMs,
          postMs: m.postMs,
          serverMs: m.serverMs,
          mineMs: m.mineMs,
          totalMs: m.totalMs,
          gasUsed: m.receipt.gasUsed.toString(),
          block: m.receipt.blockNumber,
          feePayer: m.receipt.feePayer,
          txHash: m.txHash,
        },
      };
    });

  const stepC2 = () =>
    run('c2', async () => {
      const signer = await playerSigner();
      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const h = hexlify(randomBytes(32));
        const t0 = performance.now();
        const sig = await signer.signHash(h);
        times.push(Math.round(performance.now() - t0));
        toKaiaSignature(h, sig, CONFIG.chainId, signer.address);
      }
      const sorted = [...times].sort((a, b) => a - b);
      return { result: { signer: signer.label, samplesMs: times, minMs: sorted[0], medianMs: sorted[2], maxMs: sorted[4], allRecoveredToWallet: true } };
    });

  const stepD = () =>
    run('d', async () => {
      const player = await playerSigner();
      const rec = await loadKeyRecord();
      if (!rec) throw new Error('No play key on this device: run step c first');
      const key = new Wallet(await decryptKey(rec));
      const before = await readPlayer(ctx, player.address, key.address);
      if (String(before.keyBoundTo).toLowerCase() !== player.address.toLowerCase()) {
        throw new Error(`This play key ${key.address} is not authorised for ${player.address} on chain (bound to ${before.keyBoundTo}): run step c first`);
      }
      const b = await playKeyBurst(ctx, localSigner(key, 'play key'), newMarketBase(), 5);
      const after = await readPlayer(ctx, player.address, key.address);
      return {
        links: b.sent.map((s) => ({ label: `predict nonce ${s.nonce}`, hash: s.txHash })),
        result: {
          playKey: key.address,
          player: player.address,
          txs: b.sent.map((s, i) => ({ nonce: s.nonce, txHash: s.txHash, signMs: s.signMs, postMs: s.postMs, block: b.mined[i].blockNumber, index: b.mined[i].transactionIndex, status: b.mined[i].status })),
          minedOrderByNonce: b.minedOrder,
          inNonceOrder: b.inNonceOrder,
          sendAllMs: b.sendAllMs,
          totalUntilAllMinedMs: b.totalMs,
          pointsBefore: before.points,
          pointsAfter: after.points,
          keyPointsAfter: after.keyPoints,
          creditedToPlayerNotKey: Number(after.points) - Number(before.points) === 5 && after.keyPoints === 0,
        },
      };
    });

  const stepE = () =>
    run('e', async () => {
      const signer = await playerSigner();
      const m = await signSponsorMine(ctx, signer, 'predict', predictData(newMarketBase() + 999n, 1));
      return {
        links: [{ label: 'direct predict', hash: m.txHash }],
        result: { signer: signer.label, signMs: m.signMs, postMs: m.postMs, mineMs: m.mineMs, totalMs: m.totalMs, gasUsed: m.receipt.gasUsed.toString(), vReturned: m.signature.vReturned, txHash: m.txHash },
      };
    });

  const stepF = () =>
    run('f', async () => {
      if (!playerAddress) throw new Error('Log in first');
      const bal = await getBalance(CONFIG.rpcUrl, playerAddress);
      const amount = parseEther('0.001');
      if (bal < parseEther('0.002')) {
        throw Object.assign(
          new Error(
            `NO_KAIA: this wallet holds ${formatEther(bal)} test KAIA. A user paid transfer needs test KAIA for the amount (0.001) and the fee. Send test KAIA to ${playerAddress} from ${CONFIG.faucet}, then run this step again.`
          ),
          { name: 'NoKaia' }
        );
      }
      const to = health.feePayer || playerAddress;
      const t0 = performance.now();
      let hash: string;
      let how: string;
      if (dev) {
        const w = dev.connect(new JsonRpcProvider(CONFIG.rpcUrl, CONFIG.chainId, { staticNetwork: true }));
        const tx = await w.sendTransaction({ to, value: amount });
        hash = tx.hash;
        how = 'ethers Wallet.sendTransaction (dev key)';
      } else {
        if (!embedded) throw new Error('No Privy embedded wallet');
        const out = await sendTransaction({ to, value: toBeHex(amount), chainId: CONFIG.chainId }, { uiOptions: { showWalletUIs: false }, address: embedded.address });
        hash = out.hash;
        how = 'Privy useSendTransaction().sendTransaction, uiOptions.showWalletUIs false';
      }
      const sendMs = Math.round(performance.now() - t0);
      const rc = await waitReceipt(CONFIG.rpcUrl, hash);
      if (rc.status !== 1) throw Object.assign(new Error('Transfer reverted'), { txHash: hash });
      return {
        links: [{ label: 'transfer', hash }],
        result: { how, from: playerAddress, to, amountKaia: '0.001', sendMs, totalMs: Math.round(performance.now() - t0), block: rc.blockNumber, gasUsed: rc.gasUsed.toString(), txHash: hash },
      };
    });

  const removeKey = async () => {
    await deleteKey();
    setKeyRec(null);
  };

  // ---------------------------------------------------------------- report

  const report = () => ({
    spike: 'cojam-phase0',
    release: CONFIG.release,
    origin: location.origin,
    devKeyMode: !!dev,
    config: { chainId: CONFIG.chainId, contract: CONFIG.contract, api: CONFIG.apiBase, privyAppId: CONFIG.privyAppId },
    apiHealth: health,
    launch: { ...launch, sessionRestoredOnLaunch: sessionOnLaunch.current, playKeyOnLaunch: keyOnLaunch },
    player: playerAddress || null,
    playKey: keyRec ? { address: keyRec.address, createdAt: keyRec.createdAt, authorisedTx: keyRec.authorisedTx, expiresAt: keyRec.expiresAt } : null,
    steps,
    console: consoleLines,
    reportedAt: new Date().toISOString(),
  });

  const copyReport = async () => {
    const text = json(report());
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`Copied ${text.length.toLocaleString()} characters`);
      setReportText(null);
    } catch (e) {
      setCopied(`Clipboard blocked (${errText(e)}): select the text below and copy it`);
      setReportText(text);
    }
  };

  const loggedIn = !!dev || authenticated;
  const otpStatus = emailFlow.state.status;

  return (
    <main>
      <header className="top">
        <img src="/icons/cojam-mark.svg" alt="" width="36" height="36" />
        <div>
          <h1>Cojam spike</h1>
          <p className="sub">
            Kairos {CONFIG.chainId} · {env?.standalone ? 'installed app' : 'browser tab'} · {env?.platform || '…'}
          </p>
        </div>
      </header>

      {dev && <p className="banner">Dev key mode (localhost only): a throwaway local key stands in for the Privy wallet.</p>}
      <p className={`banner ${health.ok ? 'banner-ok' : 'banner-warn'}`}>
        Fee payer {CONFIG.apiBase || '(none)'}: {health.text}
      </p>

      <StepCard id="a" title="Environment" state={steps.a} hint="User agent, installed or browser tab, platform and storage persistence. The button also asks the browser to keep storage (navigator.storage.persist).">
        <Btn onClick={stepA}>Check again and request persistent storage</Btn>
      </StepCard>

      <StepCard
        id="b"
        title="Log in with Privy email"
        state={steps.b}
        askPrompt={!dev}
        onPrompt={(p) => patch('b', { prompt: p })}
        hint={
          dev ? 'Skipped in dev key mode.' : (
            <>
              Status: {ready ? (authenticated ? 'logged in' : 'logged out') : 'Privy loading…'} · code flow: {otpStatus}. Session on this launch: {sessionOnLaunch.current === null ? '…' : sessionOnLaunch.current ? 'restored' : 'none'}.
            </>
          )
        }
      >
        {!dev && ready && !authenticated && (
          <div className="form">
            <label>
              Email
              <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <Btn onClick={sendCode} disabled={!email || otpStatus === 'sending-code'}>
              Send code
            </Btn>
            {(codeSentAt || otpStatus === 'awaiting-code-input') && (
              <>
                <label>
                  Code {codeSentAt && <small>(sent {new Date(codeSentAt).toLocaleTimeString()})</small>}
                  <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
                </label>
                <Btn onClick={submitCode} disabled={!code || otpStatus === 'submitting-code'}>
                  Log in with code
                </Btn>
              </>
            )}
            <Btn kind="plain" onClick={modalLogin}>
              Or log in with the Privy window
            </Btn>
          </div>
        )}
        {!dev && authenticated && (
          <>
            <p className="addr">
              Wallet: <code>{embedded?.address || 'creating…'}</code>
            </p>
            <Btn kind="plain" onClick={doLogout}>
              Log out
            </Btn>
          </>
        )}
        {dev && (
          <p className="addr">
            Dev key: <code>{dev.address}</code>
          </p>
        )}
      </StepCard>

      <StepCard
        id="c"
        title="Path A: setPlayKey signed by the Privy wallet"
        state={steps.c}
        askPrompt={!dev}
        onPrompt={(p) => patch('c', { prompt: p })}
        hint="Creates the play key if this device has none, builds a 0x31 setPlayKey, signs its SigHash with secp256k1_sign (no confirmation UI), converts v for Kaia, posts it to /sponsor and waits for the receipt."
      >
        <Btn onClick={stepC} disabled={!loggedIn || (!dev && !embedded) || steps.c.status === 'running'}>
          Authorise play key
        </Btn>
        <Btn kind="plain" onClick={stepC2} disabled={!loggedIn || (!dev && !embedded) || steps.c2.status === 'running'}>
          Measure 5 raw signatures
        </Btn>
      </StepCard>
      {steps.c2.status !== 'idle' && <StepCard id="c2" title="Raw signature latency" state={steps.c2} askPrompt={!dev} onPrompt={(p) => patch('c2', { prompt: p })} />}

      <StepCard
        id="d"
        title="Play key: 5 predicts back to back"
        state={steps.d}
        hint={
          <>
            Play key on this device: {keyRec === undefined ? '…' : keyRec ? <code>{keyRec.address}</code> : 'none'}
            {keyRec?.authorisedTx ? ' (authorised)' : ''}. On launch: {keyOnLaunch ? (keyOnLaunch.found ? `found (created ${keyOnLaunch.createdAt})` : `not found${keyOnLaunch.error ? `: ${keyOnLaunch.error}` : ''}`) : '…'}.
          </>
        }
      >
        <Btn onClick={stepD} disabled={!loggedIn || !keyRec || steps.d.status === 'running'}>
          Send 5 predicts
        </Btn>
        <Btn kind="danger" onClick={removeKey} disabled={!keyRec}>
          Delete play key
        </Btn>
      </StepCard>

      <StepCard id="e" title="Direct predict from the Privy wallet" state={steps.e} askPrompt={!dev} onPrompt={(p) => patch('e', { prompt: p })} hint="The same path as c with a predict, to compare latency with the play key.">
        <Btn onClick={stepE} disabled={!loggedIn || (!dev && !embedded) || steps.e.status === 'running'}>
          Predict directly
        </Btn>
      </StepCard>

      <StepCard
        id="f"
        title="User paid transfer (withdraw path)"
        state={steps.f}
        askPrompt={!dev}
        onPrompt={(p) => patch('f', { prompt: p })}
        hint={
          <>
            Sends 0.001 test KAIA with eth_sendTransaction, paid by the wallet. Wallet <code>{playerAddress || '(log in)'}</code> holds {balance ?? '…'} KAIA. Get test KAIA at{' '}
            <a href={CONFIG.faucet} target="_blank" rel="noreferrer">
              {CONFIG.faucet}
            </a>
            .
          </>
        }
      >
        <Btn onClick={stepF} disabled={!loggedIn || (!dev && !embedded) || steps.f.status === 'running'}>
          Send 0.001 KAIA
        </Btn>
        {playerAddress && (
          <Btn kind="plain" onClick={() => navigator.clipboard?.writeText(playerAddress).then(() => setCopied('Address copied'), () => setCopied('Clipboard blocked'))}>
            Copy address
          </Btn>
        )}
      </StepCard>

      <section className="step report">
        <header className="step-head">
          <span className="step-id">g</span>
          <h2>Report</h2>
        </header>
        <p className="hint">Copies every result above as JSON (addresses, hashes, timings and errors; no keys). Paste it back into the chat.</p>
        <div className="actions">
          <Btn onClick={copyReport}>Copy report</Btn>
        </div>
        {copied && <p className="ms">{copied}</p>}
        {reportText && <textarea readOnly value={reportText} rows={10} onFocus={(e) => e.currentTarget.select()} />}
      </section>

      <section className="step console">
        <header className="step-head">
          <h2>Console warnings and errors ({consoleLines.length})</h2>
        </header>
        {consoleLines.length === 0 ? (
          <p className="hint">None so far.</p>
        ) : (
          <pre className="log">
            {consoleLines
              .slice(-20)
              .map((l) => `${l.at.slice(11, 19)} ${l.level}: ${l.text}`)
              .join('\n')}
          </pre>
        )}
      </section>

      <footer className="foot">
        Contract{' '}
        <a href={`${CONFIG.explorer}/address/${CONFIG.contract}`} target="_blank" rel="noreferrer">
          <code>{CONFIG.contract}</code>
        </a>
        <br />
        Release {CONFIG.release} · launch #{launch.count}
      </footer>
    </main>
  );
}
