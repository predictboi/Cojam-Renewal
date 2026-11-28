/* Labels that exist only in the "Ticket" concept: [en, ko, ja], added to the shared dictionary (assets/i18n.js is copied unchanged). */
(function () {
  "use strict";
  var S = {
    "tk.no": ["No.", "No.", "No."],
    "tk.tray": ["Your stubs today: {n} of 5", "오늘 뗀 티켓 5장 중 {n}장", "今日の半券 5枚中{n}枚"],
    "tk.taped": ["Taped back together", "테이프로 다시 붙였어요", "テープで貼り直しました"],
    "tk.skip": ["Tap to skip", "탭하면 건너뛰어요", "タップでスキップ"],
    "tk.place": ["Place", "순위", "順位"],
    "tk.hub.h": ["Ticket: every screen", "Ticket: 전체 화면", "Ticket: 全画面"],
    "tk.hub.b": ["Every prediction is a ticket you punch. Tap a screen, or one of its states.", "모든 예측은 직접 찍는 티켓입니다. 화면이나 상태를 눌러 보세요.", "すべての予想は自分で切るチケットです。画面か状態をタップしてください。"]
  };
  var d = window.CJ_I18N.dict;
  Object.keys(S).forEach(function (k) { ["en", "ko", "ja"].forEach(function (l, i) { d[l][k] = S[k][i]; }); });
})();
