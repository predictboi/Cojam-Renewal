# States: Daily Paper against the functional reference

The functional reference is `platform/design/index.html`. Every state there exists here under the **same `?state=` name**, so the app can map them one to one. The machine readable list is `assets/states.js` (used by the hub, the state check, the captures and the audit).

`node tools/state-check.js` opens every screen in every state in EN, KO and JA and fails on a page error, a missing copy key, sideways overflow or an empty page: 215 states x 3 languages = 645 pages, 0 problems.

## Files that have another name here

| Reference | Daily Paper | Why |
| --- | --- | --- |
| `home-cards.html` | `home.html` | Named before the reference names were fixed; the state names are identical |
| `home-terminal.html` | `home-list.html` | The view is a list of stories here, not a terminal |
| `system.html?state=blocked` | `system.html?state=blocked` (and `hold.html`, the same script with `blocked` as its default) | Every hold notice links to `system.html?state=blocked` |
| `components.html` (library) | not rebuilt | The hub and `CONCEPT.md` describe the components; a library page was not asked for |

## States per screen

| Id | Screen | File | States |
| --- | --- | --- | --- |
| G1 | Gate | `gate.html` | android, accepted, dismissed, android-manual, ios, ios-other, inapp, inapp-ios, desktop, generic, installed, invited, invited-noname, invited-ios-other, invited-inapp, invited-inapp-ios |
| A1 | Log in | `login.html` | (none), empty, bademail, typo, unsupported, toomany, sendfail, sending, code, verifying, wrong, short, expired, tries, setup, returning, busy, walletfail, devicefail, refused-used, refused-provider, refused-many, refused, offline |
| A2 | First run | `first-run.html` | 1, 2, 3, settingup, code, code-valid, code-unknown, code-own, code-linked, code-offline |
| H1 | Home, card view | `home.html` | (none), fresh, noimage, imagetop, partial, syncing, slow, failed, reconnect, reconnectfail, otherdevice, loading, empty, closed, error, offline, hold |
| H2 | Home, list view | `home-list.html` | (none), fresh, syncing, slow, failed, reconnect, reconnectfail, otherdevice, loading, empty, closed, error, offline, hold |
| H3 | Day done | `done.html` | (none), moment, saving, results, zero, welcome, offline |
| R1 | Results | `results.html` | (none), open, loading, empty, nowaiting, noset, error, offline |
| K1 | Weekly ranking | `ranking.html` | (none), how, top10, unranked, winner, short, lastweek, sent, loading, error, offline, hold |
| S1 | Staking, new stake | `staking.html` | (none), empty, below, above, zero, big, paused, full, fullnone, max20, loading, review, signing, steps, sending, slow, success, failed, hidden, error, offline, hold |
| S2 | Staking, my stakes | `stakes.html` | (none), claimable, unlocking, claim, loading, empty, error, offline, hold, hold-nokaia |
| W1 | Wallet | `wallet.html` | (none), new, zero, loading, error, offline, hold |
| W2 | Convert points | `convert.html` | (none), empty, step, above, min, short, wait, cap, capglobal, paused, signing, sending, success, failed, loading, offline, hold |
| W3 | Deposit | `deposit.html` | (none), arrived, loading, error, offline |
| W4 | Withdraw CT | `withdraw.html` | (none), filled, bad, sum, own, contract, nokaia, review, signing, sending, success, failed, loading, offline |
| P1 | Profile | `profile.html` | (none), nameerror, nameword, notset, otherdevice, saved, logout, session, update, hold, unranked, help, code-open, code-sheet, code-valid, code-unknown, code-own, code-offline, code-linked |
| I1 | Invite friends | `invite.html` | (none), empty, loading, error, offline, copied, shared, hold |
| SYS | System screens | `system.html` | maintenance, update, offline, notfound, blocked |

Total: 17 screens, 215 states.

## States added here (not in the reference)

| State | What it shows |
| --- | --- |
| `results.html?state=open` | The first row with a set answer opened in place (the clipping) |
| `ranking.html?state=how` | The "How prizes work" sheet open |
| `profile.html?state=unranked` | The profile of a player with no rank yet |
| `profile.html?state=help` | The Help sheet open (the four help links moved behind one row in the copy pass) |

## States that behave differently on purpose

| State | Reference | Here | Why |
| --- | --- | --- | --- |
| `home.html?state=imagetop` | A second card layout with the picture on top | The same card as the default | The paper card has one layout: the picture is always above the headline |
| `done.html?state=results` | Today's picks with one hit pending and one miss | Every pick of today waits; the masthead shows the hit points of an earlier day on their way | The decided question rule: an outcome becomes known only after the day ends at 09:00 KST, so today's set cannot have an answer yet |
| `results.html` (none) | Today has one pending hit | Today: five waiting. Yesterday: one hit with its +50P on the way, four waiting. The set before: settled | The same rule |
| `results.html?state=noset` | Today's rows forced to waiting | Only today's set (which is all waiting by the rule) | The same rule |
| `wallet.html` Deposit and Withdraw | Links to the two pages | Links to the two pages (the earlier sheets `?state=deposit` and `?state=withdraw` on the wallet are gone) | Full pages with every state, as the reference |

## Example questions

`assets/mock.js` now carries the compliant sets of `platform/shared/src/devQuestions.ts` in EN, KO and JA: today's five (`q1` to `q5`, DEV_TODAY), yesterday's five (`p1` to `p5`, DEV_YESTERDAY) and the set before (`p6` to `p10`, DEV_EARLIER). Every question asks about the day after the set opens ("Will Bitcoin be above $100,000 at 21:00 tomorrow?"), each with its own answer source and settle time. `pastRules` is empty because every question now carries its rule. Each question also has a `focus` (the focal point of its picture) for the square thumbnail crop.

## Not rebuilt

- The component library page (`components.html`).
- The admin console (out of scope for the PWA variant).
