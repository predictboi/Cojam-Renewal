/* Labels that exist only in the "Daily Paper" concept: [en, ko, ja], added to the shared dictionary (assets/i18n.js is copied unchanged). */
(function () {
  "use strict";
  var S = {
    "pp.issue": ["Day {d}, week {w}", "{w}주차 {d}일째", "第{w}週 {d}日目"],
    "pp.no": ["No. {n} of 5", "5문제 중 {n}번", "全5問の第{n}問"],
    "pp.rank.col": ["Rank", "순위", "順位"],
    "pp.pts.col": ["Points", "포인트", "ポイント"],
    "pp.player.col": ["Player", "참가자", "プレイヤー"]
  };
  var d = window.CJ_I18N.dict;
  Object.keys(S).forEach(function (k) { ["en", "ko", "ja"].forEach(function (l, i) { d[l][k] = S[k][i]; }); });
})();
