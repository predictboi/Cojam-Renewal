# Render and wallet setup (cojam.app)

Steps for the founder. Nothing here needs a seed phrase anywhere except inside the founder's own wallet apps.

## 1. Wallets: one job each, separate seeds

| Wallet | Job | Holds | Where its key lives |
| --- | --- | --- | --- |
| **Master** | Receives the whole new supply at deploy. Funds the swap contract by plain transfer. The only address that can `withdraw` unswapped reserve from the swap. | Almost all new CT | Its own seed phrase, offline. A hardware wallet is strongly recommended. Never on a server, never in Render, never in chat. |
| **Deployer** | Sends the two deploy transactions (token, swap). After deploy it has no role in either contract. | A little KAIA (deploy costs about 2.2M gas, well under 1 KAIA) | The founder's computer only, in `contracts/.env` while deploying. Can be emptied afterwards. |
| **Pool** | Creates the DEX pool and holds the LP position. | The CT and paired asset for the pool, then the LP token | Its own seed phrase, offline like the master. |
| **Gas wallet** (fee payer and keeper) | Pays holders' network fees through Kaia fee delegation and releases the 90% after 7 days. | KAIA only, a few days of spend (start with 50 to 100 KAIA) | Render only: its **private key** goes into `FEE_PAYER_PRIVATE_KEY` on the `cojam-gas-api` service. |

Rules:
- **Do not derive all wallets from one seed phrase.** One leaked phrase would expose every wallet, including the master. At minimum, the master and pool wallets need their own phrases. Deployer and gas wallets can share an "ops" phrase if needed, since they only ever hold KAIA.
- **Render gets exactly one secret:** the gas wallet's private key (export it from the wallet app as a private key, not a seed phrase). The master, pool and deployer keys never go to Render.
- **Never paste a seed phrase or private key into a chat**, including with Claude. Claude only ever needs wallet addresses.
- The master cannot be the old Cojam owner `0xeb1622d0377da1f9815bfc6eff61afe3257a0518`: the swap contract refuses it.

Recorded mainnet addresses (`contracts/deployments/wallets.mainnet.json`):

| Wallet | Address |
| --- | --- |
| Master | `0xd9dA67b7dcf94C2837d55614A430EA4Ff477eCAb` |
| Deployer | `0xB18149317Bf633F5Dc2a6044a11103D580cA4a33` |
| Fee payer (gas wallet) | `0xB3CB36B4faE25a0661E2dDD5eca59e18B53152da` |
| Pool | `0x487939b5557B995C90f2e943104A31f900f3e0F2` |

The fee payer wallet serves both the Kairos rehearsal and mainnet: the same key, different chains.

## 2. Render: create the services from the Blueprint

1. Render dashboard: **New**, then **Blueprint**. Connect the GitHub repository `predictboi/cojam-renewal`.
2. Branch: the working branch `ccr-ae3111c3-lc250i` now, or `main` once pull request #1 is merged.
3. Render reads `render.yaml` and proposes two services:
   - `cojam-site`: static site from `site/`. No settings needed.
   - `cojam-gas-api`: Node service (fee payer API and keeper), Singapore region, one instance. It needs a paid instance type (Starter is enough). A free instance sleeps and would stop the keeper.
4. Fill the environment values Render asks for (`sync: false` keys). See section 3.

Note: the site is still the prototype with mock data. Connecting the site to the real contracts and the gas API is the next build step; until then the site deploy shows the design and flows, and the gas API can be tested on its own.

## 3. Environment values for `cojam-gas-api`

### Now: Kairos testnet rehearsal

`render.yaml` already carries every Kairos value below except the key, so the Blueprint asks for one thing only: `FEE_PAYER_PRIVATE_KEY`. Use the fee payer wallet `0xB3CB36B4faE25a0661E2dDD5eca59e18B53152da` (the same key works on Kairos and mainnet; it already holds 20 test KAIA on Kairos). A local boot with these exact values passed `/api/health` on 2026-11-14.


| Key | Value |
| --- | --- |
| `CHAIN_ID` | `1001` (already in render.yaml) |
| `KAIA_RPC_URL` | `https://public-en-kairos.node.kaia.io` |
| `SWAP_CONTRACT_ADDRESS` | `0x4948D9DFaafC8CC0ee6464208659350F11931252` |
| `SWAP_DEPLOY_BLOCK` | `233013908` |
| `OLD_CT_ADDRESS` | `0x6E86699DE0182884E5ee627E43764c718832D5e8` (test old CT on Kairos) |
| `FEE_PAYER_PRIVATE_KEY` | Private key of the fee payer wallet `0xB3CB…52da` (entered in the dashboard) |
| `ALLOWED_ORIGINS` | `https://cojam.app,https://www.cojam.app` |

Check after deploy: open `https://<cojam-gas-api>.onrender.com/api/health` (or `https://api.cojam.app/api/health` once the domain is set). It should report chain 1001, the swap address and the gas wallet balance.

### At launch: Kaia mainnet

| Key | Value |
| --- | --- |
| `CHAIN_ID` | `8217` (edit in render.yaml or the dashboard) |
| `KAIA_RPC_URL` | A dedicated mainnet RPC endpoint (public `https://public-en.node.kaia.io` works but is rate limited) |
| `SWAP_CONTRACT_ADDRESS` | Mainnet swap address from the mainnet deploy |
| `SWAP_DEPLOY_BLOCK` | Its deploy block |
| `OLD_CT_ADDRESS` | Delete it (mainnet defaults to the real old CT `0x7f223b1607171b81ebd68d22f1ca79157fd4a44b`) |
| `FEE_PAYER_PRIVATE_KEY` | Unchanged: the same fee payer wallet, now holding mainnet KAIA |

## 4. Domain: cojam.app

In Render, open each service, then **Settings**, then **Custom Domains**:

| Service | Domain to add |
| --- | --- |
| `cojam-site` | `cojam.app` (Render adds `www.cojam.app` and redirects it to the root) |
| `cojam-gas-api` | `api.cojam.app` |

Then add these records at the domain registrar (Render shows the same values on the domain page):

| Type | Name | Value |
| --- | --- | --- |
| A | `@` (cojam.app) | `216.24.57.1` (or an ALIAS / ANAME to `cojam-site.onrender.com` if the registrar supports it) |
| CNAME | `www` | `cojam-site.onrender.com` |
| CNAME | `api` | `cojam-gas-api.onrender.com` |

- Use the exact `onrender.com` names Render shows for your services; they can carry a suffix if the name was taken.
- Remove any AAAA records for these names (Render serves IPv4).
- If the registrar has CAA records, allow `letsencrypt.org` and `pki.goog`.
- Press **Verify** on each domain in Render. Render issues the HTTPS certificates itself and redirects HTTP to HTTPS.
- `.app` domains only work over HTTPS (the whole TLD is on the browser HSTS preload list), so wait for the certificate before testing.

## 5. Mainnet deploy (later, on the founder's computer)

Script: `contracts/scripts/deploy-mainnet.js`. It reads the deployer key from `DEPLOYER_PRIVATE_KEY` (set in the Claude cloud environment, or on the founder's machine) and every address from `deployments/wallets.mainnet.json`, checks everything before sending, deploys the token and the swap, checks the result and writes `deployments/kaia.json`. It never funds the swap.

- Dry run on a local fork of mainnet, nothing broadcast: `FORK_DRY_RUN=1 npx hardhat run scripts/deploy-mainnet.js` (passed on 2026-11-14 with the recorded deployer: about 2.17M gas, about 0.06 KAIA).
- Real deploy: `CONFIRM_MAINNET=yes npx hardhat run scripts/deploy-mainnet.js --network kaia`, then `node scripts/verify-sourcify.js 8217 <token> CojamToken <swap> CojamMigration`.
- The 1 year window starts in the deploy block, so deploy on launch day, after the audit.
- Order: deploy token, deploy swap, verify both, fund the swap from the master wallet app in steps, update the site and gas API addresses, then announce. Remove `DEPLOYER_PRIVATE_KEY` from the environment afterwards.

## 6. Key jobs on Render: `cojam-ops`

A Render cron job that holds the deployer key and the mainnet test wallet key, separate from the internet facing gas API. It runs only when you press **Trigger Run** (its yearly schedule runs the harmless `check`).

1. After the Blueprint syncs, open `cojam-ops`, then **Environment**, and enter `DEPLOYER_PRIVATE_KEY` (deployer `0xB181…4a33`) and `MAINNET_TEST_PRIVATE_KEY` (the test wallet). Private keys, not seed phrases.
2. **Check:** leave `OPS_TASK=check` and press **Trigger Run**. The log lists both addresses, their KAIA, old CT and nonce. Nothing is sent.
3. **Small mainnet rehearsal:** the test wallet needs at least `REHEARSAL_AMOUNT` old CT (default 100) and 0.5 KAIA. Set `OPS_TASK=rehearse-mainnet` and `CONFIRM_MAINNET=yes`, then **Trigger Run**. About 2 minutes. The log ends with `"result": "PASS"` and every transaction hash. The swapped old CT stays in the rehearsal contract forever. A dry run on a mainnet fork passed on 2026-11-14.
4. Set `CONFIRM_MAINNET` back to `no` and `OPS_TASK` back to `check`.
5. **Launch day only:** `OPS_TASK=deploy-mainnet`, `CONFIRM_MAINNET=yes`, **Trigger Run**. Then delete both keys from the dashboard.

Claude can read every result on chain from the addresses alone, so there is no need to copy logs unless a run fails.
