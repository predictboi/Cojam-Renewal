// Strings of the app only, merged last by scripts/gen-i18n.mjs over the design copy and the paper labels: [en, ko, ja].
// A null Japanese entry reuses the English text (Japanese is hidden for now, see src/i18n/langs.ts).
// Changed copy from the round 6 reviews (platform/app/reviews/) lives here, so the prototypes stay as approved.
export const S = {
  /* ---------- Korean wording (review-ux.md section 4) ---------- */
  'pp.answerat': ['Answer {time}', '{time} 확정 예정', null],
  'h.end.in': ['Last pick locks in {n}', '{n}초 뒤에 확정돼요', null],
  'h.end.now': ['Lock it now', '바로 확정하기', null],
  'pp.finishnow': ['Lock it now', '바로 확정하기', null],
  'h.qn.sr': ['Question {n} of 5', '5문제 중 {n}번', null],
  'a.fine': ['By continuing you agree to the {terms} and the {privacy}.', '계속하면 {terms} 및 {privacy}에 동의하게 돼요.', null],
  'p.login': ['Logged in as {email}', '{email}로 로그인했어요', null],
  'inv.linkcopied': ['Link copied', '링크를 복사했어요', null],
  'o.1.h': ['Five predictions a day', '하루 다섯 문제', null],
  'e.load': ['We could not load this. Your points and CT are safe on chain.', '불러오지 못했어요. 포인트와 CT는 블록체인에 안전하게 보관돼 있어요.', null],
  'sys.maint.b': ['Predictions and payouts are paused. Your points, stakes and CT are safe on chain. We will be back shortly.', '예측과 지급을 잠시 멈췄어요. 포인트와 스테이킹, CT는 블록체인에 안전하게 보관돼 있어요. 곧 돌아올게요.', null],
  'x.gas': ['Withdrawals are not sponsored. You pay a small network fee in KAIA.', '출금할 때는 Cojam이 수수료를 대신 내지 않아요. 네트워크 수수료를 KAIA로 직접 내야 해요.', null],
  'c.wait.b': ['New accounts wait 7 days before the first conversion. You can convert from {date}.', '새 계정은 가입 7일 뒤부터 전환할 수 있어요. 이 계정은 {date}부터예요.', null],
  'tx.review.h': ['Check and confirm', '내용을 확인해 주세요', null],
  'tx.step1': ['Approve {a} CT', '{a} CT 사용 승인', null],
  'tx.fail.reverted': ['Kaia rejected this transaction. Nothing was taken from your balance.', 'Kaia 네트워크에서 거래가 처리되지 않았어요. 잔액은 그대로예요.', null],
  'k.gap': ['{gap}P behind the top 10', '상위 10명까지 {gap}P 남았어요', null],
  'k.last': ['You placed {rank} last week. {amount} CT was sent to your wallet.', '지난주에 {rank}위를 했어요. 상금 {amount} CT가 지갑에 들어왔어요.', null],
  'k.pool.line': ['Each qualified player adds 1 CT to the pool: {n} so far. The pool is capped at 10,000 CT.', '자격을 갖춘 참가자 한 명당 1 CT씩 쌓여요. 지금 {n}명이고, 최대 10,000 CT까지 쌓여요.', null],
  'dp.lead': ['Send new CT or KAIA to this address on the Kaia network.', '이 주소로 새 CT나 KAIA를 보내 주세요. 반드시 Kaia 네트워크를 선택하세요.', null],
  'sys.404.b': ['The link may be old. Today\'s predictions are one tap away.', '오래된 링크일 수 있어요. 홈에서 오늘의 예측을 볼 수 있어요.', null],
  'pp.x.dec': ['Enter an amount in CT, like 250.', 'CT 수량을 숫자로 입력해 주세요. 예: 250', null],
  'a.setup.s3': ['Get this device ready to play', '이 기기에서 플레이할 준비', null],
  's.period': ['Lock period', '잠금 기간', null],
  /* "보류" becomes "이용 제한", the term Korean services use, in every place it appears */
  'sys.blocked.h': ['This account is on hold', '이 계정은 이용이 일시 제한됐어요', null],
  'hold.t': ['Account on hold', '계정 이용 제한 중', null],
  'hold.tag': ['On hold', '이용 제한', null],
  'pp.st.hold': ['On hold', '이용 제한', null],
  'sys.blocked.stops.h': ['Paused while on hold', '이용 제한 중에는 할 수 없는 것', null],
  'hold.wallet': ['You cannot convert points while on hold. You can still withdraw CT, paying the network fee in KAIA.', '이용 제한 중에는 포인트를 전환할 수 없어요. CT 출금은 할 수 있고, 네트워크 수수료는 KAIA로 직접 내요.', null],
  'hold.convert.reason': ['Converting is paused while your account is on hold.', '계정 이용이 제한된 동안에는 전환할 수 없어요.', null],
  'hold.convert': ['Converting points to CT is paused while your account is on hold. Your points are kept.', '계정 이용이 제한된 동안에는 포인트를 CT로 전환할 수 없어요. 포인트는 그대로 남아 있어요.', null],
  'hold.stake': ['New stakes are unavailable while your account is on hold. Your open stakes keep earning interest.', '계정 이용이 제한된 동안에는 새로 스테이킹할 수 없어요. 진행 중인 스테이킹은 이자가 계속 쌓여요.', null],
  'hold.fee.rv': ['Cojam does not pay this fee while your account is on hold.', '계정 이용이 제한된 동안에는 Cojam이 이 수수료를 내 드리지 않아요.', null],
  'hold.rank': ['An account on hold is left out of the weekly ranks and prizes. You still see your points for this week.', '이용이 제한된 계정은 주간 순위와 상금에서 제외돼요. 이번 주 포인트는 그대로 볼 수 있어요.', null],
  'hold.rank.pin': ['On hold: no weekly prize', '이용 제한 중: 상금 대상이 아니에요', null],
  'hold.invite': ['Inviting is paused while your account is on hold, so your code and link are hidden.', '계정 이용이 제한된 동안에는 초대를 할 수 없어서 코드와 링크를 숨겼어요.', null],
  'hold.invite.bonus': ['While your account is on hold, no invite bonus is added for points your friends earn. The bonus you already received is kept.', '계정 이용이 제한된 동안에는 친구가 포인트를 받아도 초대 보너스가 쌓이지 않아요. 이미 받은 보너스는 그대로예요.', null],

  /* ---------- English plain words (review-ux.md m3, m14) ---------- */
  'a.h1': ['Log in or sign up', '로그인 또는 가입하기', null],
  'pp.lede': ['We email you a code. No password.', '이메일로 코드를 보내 드려요. 비밀번호는 없어요.', null],
  'pp.extra': ['Done', '호외', null],
  'r.f.set': ['Answered', '확정', null],
  'x.rv.check': ['I checked the address. Transfers on Kaia cannot be undone.', '주소를 확인했어요. Kaia에서 보낸 토큰은 되돌릴 수 없어요.', null],

  /* ---------- the reason on a switched off action (review-ui M5, review-ux m6) ---------- */
  's.btn.full': ['Staking is full', '스테이킹 한도가 찼어요', null],
  's.btn.max': ['Limit of 20 stakes reached', '스테이킹 20개 한도에 도달했어요', null],
  's.btn.room': ['Up to {x} CT right now', '지금은 최대 {x} CT까지', null],
  's.btn.nobal': ['No CT to stake', '스테이킹할 CT가 없어요', null],
  's.btn.empty': ['Enter an amount', '수량을 입력해 주세요', null],
  's.btn.min': ['Minimum {n} CT', '최소 {n} CT부터', null],

  /* ---------- staking (review-ux M3, m10) ---------- */
  'tab.badge.stake': ['CT ready to withdraw', '찾을 수 있는 CT가 있어요', null],
  'pp.minclaim': ['Paid with your stake at unlock, or claim from {n} CT', '잠금이 풀리면 원금과 함께 받아요. {n} CT부터는 먼저 받을 수 있어요.', null],

  /* ---------- the 7 day wait before the first conversion (ruling 6) ---------- */
  'c.first': ['First conversion', '첫 전환', null],
  'c.first.v': ['7 days after you join', '가입 7일 뒤부터', null],
  'c.first.at': ['from {date}', '{date}부터', null],
  'c.wait.rule': ['New accounts wait 7 days after joining before their first conversion.', '새 계정은 가입하고 7일이 지나야 처음 전환할 수 있어요.', null],

  /* ---------- ranking (ruling 7) ---------- */
  'k.none.h': ['No rank yet', '아직 순위가 없어요', null],
  'k.elig.days': ['Days played {k} of 3', '이번 주 플레이 {k}/3일', null],
  'k.elig.age': ['Prizes from {date}', '{date}부터 상금 대상', null],
  'k.elig.play': ['Finish today\'s 5 to get on the board', '오늘의 5문제를 끝내면 랭킹에 올라요', null],
  'k.sent.lbl': ['Prizes sent', '상금 지급', null],

  /* ---------- results and the points balance (review-ux m18) ---------- */
  'hd.points': ['Points balance {p}. Open wallet', '포인트 잔액 {p}. 지갑 열기', null],
  'r.bal.note': ['The figure at the top of every screen is your points balance: the points you can convert to CT.', '모든 화면 위쪽의 숫자는 지금 가진 포인트예요. 이 포인트를 CT로 전환할 수 있어요.', null],

  /* ---------- profile (review-ux m11, review-ui L17) ---------- */
  'p.device.untilfull': ['Ready to play on this device until {date}.', '{date}까지 이 기기에서 플레이할 수 있어요.', null],
  'p.device.renew': ['It renews by itself when you open Cojam in its last 7 days.', '남은 기간이 7일보다 적을 때 Cojam을 열면 자동으로 연장돼요.', null],
  'p.uptodate.short': ['Up to date', '최신 버전이에요', null],
  'p.legal': ['Terms and privacy', '약관 및 개인정보', null],

  /* ---------- invite (review-ux m17, review-ui L17) ---------- */
  'inv.friend': ['Your friend gets +{w}P', '친구는 +{w}P를 받아요', null],
  'inv.empty.h': ['No friends yet', '아직 가입한 친구가 없어요', null],
  'inv.empty.b': ['Your bonus starts with the first point your first friend earns.', '첫 친구가 첫 포인트를 받는 순간부터 보너스가 쌓여요.', null],

  /* ---------- support (ruling 8) ---------- */
  'help.contact': ['Contact support', '고객 지원에 문의', null],
  'help.copy': ['Copy the address', '주소 복사', null],

  /* ---------- Terms and Privacy (ruling 1): drafts, marked as such, for the founder's lawyer ---------- */
  'legal.draft': ['Draft, under legal review', '초안: 법률 검토 중이에요', null],
  'legal.updated': ['Last updated {date}', '마지막 수정 {date}', null],
  'terms.h': ['Terms of Use', '이용약관', null],
  'terms.1.h': ['The game', '게임', null],
  'terms.1.b': ['Cojam Daily is a prediction game. Every day you answer five questions and earn points: +100P for all five and +50P for each right answer.', 'Cojam Daily는 예측 게임이에요. 매일 다섯 문제에 답하고 포인트를 받아요. 다섯 문제를 모두 풀면 +100P, 맞힌 문제마다 +50P예요.', null],
  'terms.2.h': ['Your account and wallet', '계정과 지갑', null],
  'terms.2.b': ['You log in with your email through Privy, a login service. A wallet on the Kaia network is created for you inside the app. Keep your email account safe: whoever can read its codes can log in as you.', 'Privy라는 로그인 서비스를 통해 이메일로 로그인해요. 앱 안에서 Kaia 네트워크 지갑이 만들어져요. 이메일 계정을 안전하게 지켜 주세요. 그 이메일로 받은 코드를 볼 수 있는 사람은 누구나 내 계정으로 로그인할 수 있어요.', null],
  'terms.3.h': ['Points', '포인트', null],
  'terms.3.b': ['Points are a game score. They have no cash value until you convert them to CT, and they cannot be bought, sold or sent to anyone. A conversion cannot be undone. New accounts can convert from 7 days after joining, within a daily limit.', '포인트는 게임 점수예요. CT로 전환하기 전에는 현금 가치가 없고, 사고팔거나 다른 사람에게 보낼 수 없어요. 전환은 되돌릴 수 없어요. 새 계정은 가입 7일 뒤부터 하루 한도 안에서 전환할 수 있어요.', null],
  'terms.4.h': ['Transactions on Kaia', 'Kaia 거래', null],
  'terms.4.b': ['Picks, conversions, stakes, claims and withdrawals are transactions on the Kaia blockchain. They are public, and once confirmed they cannot be reversed, by you or by Cojam. Check every address before you send.', '선택, 전환, 스테이킹, 이자 받기, 출금은 Kaia 블록체인 거래예요. 거래는 공개되고, 한 번 확정되면 나도 Cojam도 되돌릴 수 없어요. 보내기 전에 주소를 꼭 확인해 주세요.', null],
  'terms.5.h': ['Staking', '스테이킹', null],
  'terms.5.b': ['A stake is locked for the period you choose. There is no early exit: once the stake unlocks, you can withdraw the CT with its interest.', '스테이킹은 고른 기간 동안 잠겨요. 중도 해지는 없어요. 잠금이 풀리면 원금을 이자와 함께 찾을 수 있어요.', null],
  'terms.6.h': ['Fair play', '공정한 이용', null],
  'terms.6.b': ['An account can be put on hold when we see abuse, such as one person running many accounts. While an account is on hold some features are paused, and the app shows which.', '한 사람이 여러 계정을 쓰는 것처럼 부정 이용이 보이면 계정 이용을 제한할 수 있어요. 이용이 제한된 동안에는 일부 기능이 멈추고, 어떤 기능인지 앱에서 알려 드려요.', null],
  'terms.7.h': ['Contact', '문의', null],
  'terms.7.b': ['Questions about these terms: {mail}', '약관에 관한 문의: {mail}', null],
  'privacy.h': ['Privacy Policy', '개인정보 처리방침', null],
  'privacy.1.h': ['What we keep', '보관하는 정보', null],
  'privacy.1.b': ['Your email address, your wallet address, the display name you set, your language, your picks, points and ranks, and the invite code that links you to a friend.', '이메일 주소, 지갑 주소, 직접 정한 표시 이름, 언어, 내 선택과 포인트와 순위, 친구와 연결된 초대 코드를 보관해요.', null],
  'privacy.2.h': ['Login through Privy', 'Privy를 통한 로그인', null],
  'privacy.2.b': ['Privy sends your login code and keeps the wallet that is created for you. Privy\'s own privacy policy covers what it processes.', 'Privy가 로그인 코드를 보내고, 나를 위해 만들어진 지갑을 관리해요. Privy가 처리하는 정보에는 Privy의 개인정보 처리방침이 적용돼요.', null],
  'privacy.3.h': ['Public on the blockchain', '블록체인에 공개되는 정보', null],
  'privacy.3.b': ['Your picks and every transaction of your wallet are recorded on the Kaia blockchain. Anyone can see them with your wallet address, and they cannot be deleted.', '내 선택과 지갑의 모든 거래는 Kaia 블록체인에 기록돼요. 지갑 주소만 알면 누구나 볼 수 있고, 지울 수 없어요.', null],
  'privacy.4.h': ['On this device', '이 기기에 저장되는 정보', null],
  'privacy.4.b': ['The app keeps a play key and the picks it has not sent yet on this device, so your picks are saved without a signature each time. Logging out removes the play key.', '앱은 매번 서명하지 않아도 선택이 저장되도록 플레이 키와 아직 보내지 않은 선택을 이 기기에 보관해요. 로그아웃하면 플레이 키가 지워져요.', null],
  'privacy.5.h': ['Contact', '문의', null],
  'privacy.5.b': ['Questions about your data: {mail}', '개인정보에 관한 문의: {mail}', null],
};
