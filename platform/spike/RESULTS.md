# Phase 0 spike: phone results

## Run 1: Android, Chrome browser tab (2026-11-26 17:05 UTC)
Android 10, Chrome 158, not installed (display mode `browser`), service worker controlling.

| Step | Result | Prompt | Timing |
| --- | --- | --- | --- |
| b. Email login (custom form) | ok, 6 digit code, wallet made by `createWallet()` | none | send code 377 ms, login 840 ms, create wallet 1,358 ms |
| c. `setPlayKey` signed by the Privy wallet (`secp256k1_sign`), sponsored | ok, 65 byte signature, v = 27 | none | sign 326 ms, total 2,120 ms, 44,695 gas |
| c2. Five raw signatures | ok, all recover to the wallet | none | median 167 ms (161 to 262) |
| d. Five predicts by the play key, sponsored | ok, mined in nonce order, 5 points to the player, 0 to the key | none | local sign 1 to 6 ms, about 400 ms per sponsor request, all mined in 2,984 ms |
| e. Direct predict by the Privy wallet, sponsored | ok | none | sign 229 ms, total 2,009 ms, 75,961 gas |
| f. User paid transfer through Privy `sendTransaction` | ok | none | 2,164 ms |

Transactions (Kairos): setPlayKey `0x7237791a43dfbad20dc6976fa689b35cc16af2c885f1af0d8bc9c62a0ff03eac`, first predict `0x8ab9486e65161fbea30afeb54251b7e36b6457234859f57e1335a109d575655a`, direct predict `0x2a3a593ff484064ee3e46b19b05552eb59469db5bc70173a2042586372891395`, transfer `0x80be306e1d3d8d5850f0ef199bc39966a043cc0d90912b8aa610093c4227dc20`.

Conclusion so far: the Privy embedded wallet signs raw Kaia fee delegated transactions without any prompt, and the play key path works end to end on a real phone.

## Run 2: Android, installed app (2026-11-26 17:14 UTC)
Same phone, launched from the home screen icon (display mode `standalone`, launched from `pwa`), second launch.

| Check | Result |
| --- | --- |
| Session found on launch | yes (`sessionRestoredOnLaunch: true`) |
| Play key found on launch (IndexedDB) | yes, the same key as run 1 |
| Email login inside the installed app (leaving for Mail and coming back) | ok, no prompt; the report also shows a fresh code login 20 s after the code was sent, so a login was done again in this run |
| `setPlayKey` by the Privy wallet, sponsored | ok, no prompt, sign 1,273 ms (first signature after launch), total 3,713 ms |
| Five raw signatures | ok, no prompt, median 313 ms |
| Five predicts by the play key | ok, nonce order, 5 points to the player; about 630 ms per sponsor request, all mined in 5,566 ms |
| Direct predict, user paid transfer | ok, no prompt |

Notes: the first Privy signature after a cold launch is slower (about 1.3 s, the wallet iframe warming up), later ones about 0.3 s. Sponsor requests were slower than in run 1 (about 630 ms against 400 ms): free Render instance plus the public RPC node.

## Still to run
- iPhone: Safari tab, then the installed app (leaving for Mail to read the code, relaunch).
- Relaunch after a day and after 7 days.
- Privy's written answer on billing for raw signatures and email logins.
