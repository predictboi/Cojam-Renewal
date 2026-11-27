import io, json
def rd(p): return io.open(p, encoding='utf-8').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8').write(s)

# ---- COPY.md: the word table straight from the two measurements
B = json.load(open('captures/words-before.json')); A = json.load(open('captures/words-after.json'))
names = [('wallet.html', 'Wallet'), ('convert.html', 'Convert'), ('profile.html', 'Profile'), ('invite.html', 'Invite'), ('staking.html', 'Staking, new stake'), ('stakes.html', 'Staking, my stakes'),
         ('results.html', 'Results'), ('ranking.html', 'Ranking'), ('done.html', 'Day done'), ('login.html', 'Log in'), ('first-run.html', 'First run, page 1'), ('first-run.html?state=2', 'First run, page 2'), ('first-run.html?state=3', 'First run, page 3'),
         ('wallet.html?state=hold', 'Wallet, on hold'), ('staking.html?state=hold', 'Staking, on hold'), ('stakes.html?state=hold', 'My stakes, on hold'), ('convert.html?state=hold', 'Convert, on hold'), ('invite.html?state=hold', 'Invite, on hold')]
rows = []
for k, n in names:
    cells = [n]
    for l in ('en', 'ko', 'ja'):
        b, a = B[k][l], A[k][l]; cells += [str(b), str(a), '%d%%' % round((b - a) * 100.0 / b)]
    rows.append('| ' + ' | '.join(cells) + ' |')
for k, n in [('home.html?state=partial', 'Home, card view (unchanged)'), ('home-list.html', 'Home, list view (unchanged)')]:
    rows.append('| %s | %d | %d | | %d | %d | | %d | %d | |' % (n, B[k]['en'], A[k]['en'], B[k]['ko'], A[k]['ko'], B[k]['ja'], A[k]['ja']))
s = rd('COPY.md')
a = s.index('| Wallet | '); b = s.index('\nNew in this round')
s = s[:a] + '\n'.join(rows) + '\n' + s[b:]
new = 'New in this round, so there is no "before": Deposit %d / %d / %d, Withdraw %d / %d / %d, Gate (Android) %d / %d / %d, Account on hold explanation %d / %d / %d (EN / KO / JA).' % tuple(A[k][l] for k in ('deposit.html', 'withdraw.html', 'gate.html?state=android', 'system.html?state=blocked') for l in ('en', 'ko', 'ja'))
a = s.index('New in this round'); b = s.index('\n', a); s = s[:a] + new + s[b:]
def cut(k, l): return round((B[k][l] - A[k][l]) * 100.0 / B[k][l])
a = s.index('**Staking ('); b = s.index('do not.**', a)
s = s[:a] + '**Staking (%d%%, %d%%, %d%%) and my stakes (%d%%, %d%%, %d%%) ' % (cut('staking.html', 'en'), cut('staking.html', 'ko'), cut('staking.html', 'ja'), cut('stakes.html', 'en'), cut('stakes.html', 'ko'), cut('stakes.html', 'ja')) + s[b:]
wr('COPY.md', s)

# ---- CONCEPT.md
s = rd('CONCEPT.md')
def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b)
rep("| Display, Japanese | **Noto Serif JP** at 900 (Google Fonts) | Kana and kanji in every display role, switched by `:lang(ja)`; numerals stay Besley |",
    "| Display, Japanese | **Shippori Antique B1** (Google Fonts) | Kana and kanji in every display role, switched by `:lang(ja)`; numerals stay Besley. An antique face is the Japanese counterpart of a Clarendon: sturdy bracketed kana, heavy low contrast kanji. It replaced Noto Serif JP, which read lighter and more formal than the Latin and Korean slabs. The free font has one weight, so the browser emboldens it at display weights; production should license a true heavy antique |")
rep("The home screen at rest carries no blue except the mark in the nameplate.", "The home screen at rest carries blue only in the mark of the nameplate and in the one text link on the card (\"Rules\", the way to the answer source).")
rep("## What was deliberately avoided", '''## Pictures: the halftone as a production approach

- **In production the halftone is rendered once per picture on the server.** When a question's picture is approved in the admin, a job prints it through the screen (grey, lift, dot screen, threshold) and stores a 1 bit PNG at two sizes (card and 2x), plus the square block for the list. The app shows plain images: no filters, nothing to compute on the phone, identical on every device.
- **The CSS version in this prototype is the stand in.** `.ht` builds the same look live (blur, multiply with a dot gradient, hard contrast) so that any picture dropped into the mock works without a build step. Its parameters are the specification for the server job: `--ht-cell` 5 px dot pitch at 1x, `--ht-lift` 2.9, `--ht-contrast` 9.
- **Drags stay cheap either way.** In the prototype the picture, the colour wash and the stamps each have their own compositor layer, so the filters run once per picture and never while the card moves (measured in `REVIEW.md`: raster work during a drag fell by about 60%).
- **The list thumbnail is a different cut.** At 60 px a dot screen turns to texture, so the list uses a square block: the picture is cropped on its focal point (`focus` on each question, enlarged 1.5 times), pushed to two tones and reversed, so the subject stands in paper on a block of ink, like a small printer's cut. In production it is the third file of the same server job.
- **The source line on the card is a worded control.** The answer source and the settle time are one button that ends in an underlined "Rules" with a chevron, in place of the earlier small info icon.

## Copy on the surface

A screen answers one question with one figure or one action; labels are 1 to 3 words; explanations sit behind a "?" that opens a short sheet. The rule, the word counts before and after, and where every removed sentence went are in `COPY.md`.

## What was deliberately avoided''')
rep("The product and its rules (5 questions a day,", "State names follow the functional reference one to one (`STATES.md`, 17 screens and 215 states). The product and its rules (5 questions a day,")
rep("the copy and the mock data (`assets/i18n.js` and `assets/mock.js` are unchanged copies)", "the copy dictionary (`assets/i18n.js` is an unchanged copy; `assets/mock.js` is a copy whose example questions were replaced by the compliant sets of `platform/shared/src/devQuestions.ts`)")
rep("| `MOTION.md` |", "| `STATES.md` | Every screen and state, the names that differ from the reference, what was added and what behaves differently |\n| `COPY.md` | The copy rule, visible words per screen before and after, and where each explanation went |\n| `assets/states.js` | The machine readable list of screens and states (hub and tools) |\n| `MOTION.md` |")
rep("| `tools/` | `capture-all.js`, `shot.js`, `sheet.py`, `flow-test.js`, `audit-all.sh` |", "| `tools/` | `state-check.js`, `capture-all.js`, `shot.js`, `sheet.py`, `flow-test.js`, `audit-all.sh`, `word-count.js`, `lang-switch-check.js`, `motion-run.js`, `motion-trace.js`, `motion-mp4.sh` |")
wr('CONCEPT.md', s)

# ---- MOTION.md
s = rd('MOTION.md')
rep("| Errors and failures | | | Nothing plays | | |", "| Deposit arrived | Feedback | A deposit is seen on chain | The \"Waiting for deposits\" line becomes a stamp with the amount, which lands like any stamp; a slip of paper says how much | 230 ms `--ease-thunk` | Stamp is simply there |\n| Errors and failures | | | Nothing plays | | |")
rep("| Going to press | State: this answer is not set yet | Always, on waiting rows | A 18 x 10 px frame with bars moving slowly to the left, beside \"Waiting, 09:00\" (it replaces the clock icon and is labelled \"Going to press\" for screen readers) |",
    "| Going to press | State: this answer is not set yet | Always, on waiting rows (and beside \"Waiting for deposits\") | A 18 x 10 px frame with bars moving slowly to the left, beside the time the answer is due (it replaces the clock icon and the word \"Waiting\", and is labelled \"Going to press\" for screen readers) |")
wr('MOTION.md', s)
print('docs ok')
