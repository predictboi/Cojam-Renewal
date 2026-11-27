/* Concept D "Clean": the spoken headlines. Each entry is [en, ko, ja], written natively in each language, and added on top of the
   product dictionary in i18n.js (which is copied unchanged). The meaning of the product copy does not change: these lines are the
   one sentence a screen says before its figure. A line break (\n) is part of the headline. */
(function () {
  "use strict";
  var V = {
    "v.home.h": ["5 predictions today.\nDone in 3 minutes.", "오늘의 예측 5개,\n3분이면 끝나요", "今日の予想は5問、\n3分で終わります"],
    "v.home.h.part": ["{k} to go.\nKeep the streak going.", "{k}개 남았어요.\n마저 골라 볼까요?", "あと{k}問です。\nこのまま続けましょう"],
    "v.home.h.last": ["One last pick\nand today is done.", "마지막 하나만 고르면\n오늘 예측이 끝나요", "最後の1問を選べば\n今日の予想は完了です"],
    "v.home.h.done": ["That is all five.\nNicely done.", "5개를 모두 골랐어요.\n수고했어요", "5問すべて選びました。\nおつかれさまです"],
    "v.done.h": ["All five are in.\nSee you tomorrow at 9.", "오늘 예측을 모두 마쳤어요.\n내일 오전 9시에 또 만나요", "今日の予想が完了しました。\n明日の朝9時にまた会いましょう"],
    "v.results.h": ["You earned {p}P\nthis week.", "이번 주에\n{p}P를 모았어요", "今週は\n{p}Pを獲得しました"],
    "v.rank.h": ["You are #{n}\nthis week.", "이번 주 {n}위를\n달리고 있어요", "今週は{n}位に\nつけています"],
    "v.login.h": ["Enter your email\nand start playing.", "이메일만 입력하면\n바로 시작할 수 있어요", "メールアドレスだけで\nすぐに始められます"],
    "v.login.code.h": ["Enter the 6 digits\nwe emailed you.", "메일로 보낸\n6자리 코드를 입력해 주세요", "メールで届いた\n6桁のコードを入力してください"],
    "v.o.1.h": ["Five quick predictions,\nevery day.", "매일 5개,\n가볍게 예측해요", "毎日5問、\n気軽に予想します"],
    "v.o.2.h": ["Pick all five\nand get 100P.", "5개를 모두 고르면\n100P를 받아요", "5問すべて選ぶと\n100Pもらえます"],
    "v.o.3.h": ["Your points\nturn into CT.", "모은 포인트는\nCT로 바꿀 수 있어요", "貯めたポイントは\nCTに交換できます"],
    "v.o.2.all": ["All 5 done", "5개 완료", "5問完了"],
    "v.o.2.hit": ["Each hit", "적중할 때마다", "的中するたび"],
    "v.rank.col": ["Player", "참가자", "プレイヤー"],
    "v.stake.q": ["How much CT\nwill you stake?", "CT를 얼마나\n맡길까요?", "CTをいくら\n預けますか？"],
    "v.stake.period": ["For how long?", "얼마 동안 맡길까요?", "期間はどうしますか？"],
    "v.stakes.h": ["You have {a} CT\nearning interest.", "지금 {a} CT에\n이자가 쌓이고 있어요", "現在 {a} CTに\n利息がついています"],
    "v.wallet.h": ["CT you can use now", "지금 쓸 수 있는 CT는", "いま使えるCTは"],
    "v.convert.h": ["How many points\nwill you convert?", "포인트를 얼마나\n전환할까요?", "何ポイント\n交換しますか？"],
    "v.dep.h": ["Send it to\nthis address.", "이 주소로\n보내 주세요", "このアドレスに\n送ってください"],
    "v.wd.h": ["Where should\nthe CT go?", "CT를 어디로\n보낼까요?", "CTをどこに\n送りますか？"],
    "v.inv.h": ["Invite a friend and get\n{r}% of their points.", "친구를 초대하면\n친구 포인트의 {r}%를 받아요", "友だちを招待すると\n獲得ポイントの{r}%がもらえます"]
  };
  var I = window.CJ_I18N;
  Object.keys(V).forEach(function (k) { I.langs.forEach(function (l, i) { I.dict[l][k] = V[k][i]; }); });
})();
