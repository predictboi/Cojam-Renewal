/* Labels that exist only in the Matchday concept: [en, ko, ja], added to the shared dictionary (assets/i18n.js is copied unchanged). */
(function () {
  "use strict";
  var S = {
    "md.match": ["Match {n} of 5", "5경기 중 {n}경기", "第{n}試合 / 全5試合"],
    "md.matchn": ["Match {n}", "{n}경기", "第{n}試合"],
    "md.vs": ["VS", "VS", "VS"],
    "md.fulltime": ["Full time", "경기 종료", "試合終了"],
    "md.final": ["Final score", "최종 스코어", "最終スコア"],
    "md.final.sr": ["{l} picks on the left, {r} picks on the right", "왼쪽 선택 {l}개, 오른쪽 선택 {r}개", "左の選択 {l}、右の選択 {r}"],
    "md.w": ["W", "승", "勝"],
    "md.l": ["L", "패", "負"],
    "md.live": ["Live", "라이브", "ライブ"],
    "md.left": ["Left", "왼쪽", "左"],
    "md.right": ["Right", "오른쪽", "右"],
    "md.form": ["Form", "최근 전적", "直近の成績"],
    "md.club": ["Your club", "내 팀", "マイクラブ"],
    "md.prizeline": ["Prize places end here", "여기까지 상금권", "ここまで賞金圏"],
    "md.table": ["League table", "리그 순위표", "リーグ順位表"],
    "md.card": ["Match card", "오늘의 대진", "本日のカード"],
    "md.col.rank": ["Pos", "순위", "順位"],
    "md.col.pts": ["Pts", "포인트", "Pt"],
    "md.office": ["Club office", "클럽 사무실", "クラブオフィス"],
    "md.share": ["Share", "비율", "配分"],
    "md.hub.h": ["Matchday", "매치데이", "マッチデー"],
    "md.hub.b": ["A design variation of the Cojam Daily Prediction app: every question is a fixture, every day is a five match card.", "Cojam 데일리 예측 앱의 디자인 변주입니다. 모든 질문은 한 경기이고, 하루는 다섯 경기로 이루어진 대진표입니다.", "Cojamデイリー予想アプリのデザインバリエーションです。ひとつの質問が1試合、1日は5試合のカードです。"],
    "md.hub.play": ["Matchday", "경기장", "スタジアム"],
    "md.hub.start": ["Getting in", "입장", "入場"]
  };
  var d = window.CJ_I18N.dict;
  Object.keys(S).forEach(function (k) { ["en", "ko", "ja"].forEach(function (l, i) { d[l][k] = S[k][i]; }); });
})();
