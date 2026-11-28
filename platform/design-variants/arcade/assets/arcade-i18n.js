/* Labels that exist only in the "Pocket Arcade" concept: [en, ko, ja], added to the shared dictionary (assets/i18n.js is copied unchanged). */
(function () {
  "use strict";
  var S = {
    "ar.rank.col": ["Rank", "순위", "順位"],
    "ar.pts.col": ["Points", "포인트", "ポイント"],
    "ar.player.col": ["Player", "참가자", "プレイヤー"],
    "ar.paid": ["Paid", "지급 완료", "支払済"],
    "ar.press": ["Waiting for the answer", "정답 대기 중", "結果待ち"],
    "ar.podium": ["Top 3", "상위 3명", "トップ3"],
    "ar.sheet": ["Today's sticker sheet", "오늘의 스티커판", "今日のステッカーシート"],
    "ar.skip": ["Tap to skip", "탭해서 건너뛰기", "タップでスキップ"]
  };
  var d = window.CJ_I18N.dict;
  Object.keys(S).forEach(function (k) { ["en", "ko", "ja"].forEach(function (l, i) { d[l][k] = S[k][i]; }); });
})();
