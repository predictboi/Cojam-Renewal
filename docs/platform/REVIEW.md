# Review of the screen spec and the development plan (2026-11-26)

Reviewer pass over `SCREEN-SPEC.md` and `DEV-PLAN.md` against `PLAN-SOURCE.md` and `DECISIONS.md`. Verdict: both drafts are sound and cover the scope without adding features. The items below must be folded in before design and build start. Items marked **Founder** wait for an answer.

## A. Changes to make (reviewer decisions)

| # | Finding | Change |
| --- | --- | --- |
| A1 | One Privy signature per swipe is the largest running cost (about 477,000 signatures a month at 3,000 daily players, far above the 50,000 included) and puts Privy's signing latency inside every swipe. | Add a **play key**: on login the PWA creates a local key, and the user's Privy wallet authorises it once on chain (`setPlayKey(address key, uint64 expiresAt)`, one sponsored transaction). `predict` accepts calls from the play key on behalf of its player. Swipes are then signed locally: no Privy signature, no prompt, no network round trip to sign. The play key can only predict: it cannot convert, stake, withdraw or hold funds, so losing it risks nothing but a re-authorisation. Privy signs only login time authorisation and value actions (convert, approve, stake, claim, withdraw). This becomes the recommended path; the first spike must prove it next to the direct Privy path. **Founder: confirm** |
| A2 | `settle` needs all 5 markets of a day resolved, so one slow question (for example "this week's close") holds back every hit point of that day. | Settle per market with a bitmask of credited slots in `UserDay`, or require every market of a day to resolve within 48 hours of the day's end. Recommended: per market credit, plus the 48 hour rule for question drafting. |
| A3 | The two drafts disagree on retries: the spec has 3 silent retries (2, 5, 10 s), the plan has 8 with backoff until the market closes. | Use the plan's policy (retry until the market closes); the spec's "Not saved. Pick again." appears only for non retryable failures or after the close. |
| A4 | The two drafts disagree on the day done screen: the spec waits for confirmation before "+100P paid", the plan shows it optimistically. | Follow the spec and its rule "never show a result before it is confirmed": "Saving your picks. 100P follows." until the fifth transaction is mined. With 1 second blocks this is brief. |
| A5 | The plan adds states the spec does not have: player registration on first login, hit points pending for the correction window, the wait before the first conversion, conversion caps, "staking is full for now". | Add them to A1 / A2 (registration in progress, registration refused), R1 and the point pill (pending hit points with the time they land), W2 (wait and caps with exact copy), S1 (full state). |
| A6 | The spec has a 5 item tab bar and Profile in the header; the plan lists the same screens. Consistent. | None. |
| A7 | The plan's admin hosts (`admin.cojam.app`, `app-api.cojam.app`) and the spec's admin sign in are compatible, but the spec leaves the admin sign in method open. | Admin signs in with Privy too, restricted to an allow list of accounts; on chain owner actions are signed by the owner wallet, not by the server. |
| A8 | Timeline: the source plan says 2 weeks; the plan's phases add up to about 12 weeks with a beta. | Keep the phases, but run them in parallel with agents and present a compressed schedule after the spike. **Founder: which matters more, the 2 week date or the Kairos beta** |

## B. Founder decisions that change the build (defaults proposed)

| # | Question | Proposed default |
| --- | --- | --- |
| B1 | Play key (A1) | Yes |
| B2 | Login providers | Google, Apple, LINE, and Kakao through custom OAuth. No email, no X, Discord, Telegram |
| B3 | Day and week boundary | New set at 09:00 KST every day; week starts Monday 09:00 KST |
| B4 | When hit points land | About 6 hours after the answer (the AI's second check can still fix a wrong answer before anyone is paid); shown as pending until then |
| B5 | Wrong answer after points were paid | Pay the players who were actually right; never take points back |
| B6 | Anti abuse package | Registration check at first login, 7 day wait before the first conversion, conversion caps (50 CT per user per day, 20,000 CT per day in total), suspicious accounts lose sponsored gas and can be frozen (never debited) |
| B7 | Weekly pool | Count only qualified players (played 3 or more days that week, account older than 7 days) and cap the pool at 10,000 CT a week |
| B8 | Staking | Tier by each position's size; interest stops at the end of the lock; no early exit; several positions per user (up to 20); interest for the full lock is reserved when the position opens, so "full for now" appears when the interest fund runs low |
| B9 | Interest minimum | 10 CT minimum while locked; any amount once the lock has ended (a 100 CT, 30 day stake earns only about 0.66 CT) |
| B10 | Owner key for the two contracts | Same master wallet as the token, or a new multisig |
| B11 | Reward funding | Which wallet funds conversions, airdrops and staking interest, and how much at launch |
| B12 | Fiat display | KRW in Korean only, as on the swap site; no fiat in EN and JA |
| B13 | External audit | Staking holds user principal: decide whether a paid audit precedes mainnet |
| B14 | Notifications | Not in the plan: leave out at launch |

Every other open question in the two drafts takes its proposed default unless the founder objects.

## C. Design stage inputs

- One shared token file and one component library for the PWA and the admin, built from the landing's tokens (`site/assets/tokens.css`, direction B: blue `#124CC4`, lime `#D6FF3D`, ink `#0B1530`, sky `#97DBFF`, off white `#FDFDFF`, Pretendard, the display face of the landing headlines, ink borders with offset shadows, pill controls).
- Skills in order: `hallmark` or `impeccable` for direction on the key screens (H1, H3, K1, S1, W1), build with `ui-review-loop` (tokens, press feedback, capture and audit at 360, 390, 430), `impeccable` to polish, `web-design-guidelines` and an accessibility review, then the independent reviewer.
- The component inventory in section 6 of the spec is the build list: every component is built once in the library and reused on every screen, so the product reads as one.
