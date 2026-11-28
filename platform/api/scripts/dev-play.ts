// Dev smoke run against a local API started with AUTH_DEV_BYPASS=1 DEV_CHAIN=stub (see README):
// authorises a fresh play key from the dev wallet of X-Dev-User, then answers today's five markets with it.
//   npx tsx scripts/dev-play.ts [user] [apiUrl]
import { encodeFunctionData, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { cojamPredictAbi } from "../src/chain/abi.ts";
import { devWalletKey } from "../src/auth/privy.ts";
import { signSenderTx } from "../src/feeDelegation/decode.ts";

const user = process.argv[2] ?? "minji";
const api = process.argv[3] ?? "http://localhost:8080";
const H = { "x-dev-user": user, "content-type": "application/json" };
const get = async (p: string) => (await fetch(api + p, { headers: H })).json() as Promise<any>;
const post = async (p: string, body: unknown, headers: Record<string, string> = H) =>
  (await fetch(api + p, { method: "POST", headers, body: JSON.stringify(body) })).json() as Promise<any>;

const cfg = await get("/v1/config");
const session = await post("/v1/session", {});
console.log("session", session.registration, session.wallet);
const walletKey = devWalletKey(user);
const wallet = privateKeyToAccount(walletKey).address;
const playKey = generatePrivateKey();
const keyAddr = privateKeyToAccount(playKey).address;
const exp = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);
const setKey = await signSenderTx(walletKey, {
  from: wallet,
  to: cfg.contracts.predict as Address,
  data: encodeFunctionData({ abi: cojamPredictAbi, functionName: "setPlayKey", args: [keyAddr, exp] }),
  gasLimit: cfg.gasLimits.setPlayKey,
  chainId: cfg.chainId,
  nonce: Date.now() % 100000,
});
console.log("setPlayKey", await post("/v1/tx/sponsor", { rawTransaction: setKey }));
const today = await get("/v1/today");
for (const [i, m] of today.markets.entries()) {
  if (m.myChoice) continue;
  const raw = await signSenderTx(playKey as Hex, {
    from: keyAddr,
    to: cfg.contracts.predict as Address,
    data: encodeFunctionData({ abi: cojamPredictAbi, functionName: "predict", args: [BigInt(m.marketId), (i % 2) + 1] }),
    gasLimit: cfg.gasLimits.predict,
    chainId: cfg.chainId,
    nonce: i,
  });
  // No bearer: a play key predict is sponsored on the strength of the on chain binding.
  console.log("predict", m.marketId, await post("/v1/tx/sponsor", { rawTransaction: raw }, { "content-type": "application/json" }));
}
const after = await get("/v1/today");
console.log("answered", after.answered, "completed", after.completed, "completion", after.completion);
