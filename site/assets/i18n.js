// Minimal i18n for the placeholder. English is the source; Korean and Japanese are translations.
// Language order: ?lang= value, /ko or /ja path, saved choice, browser language, English.
(function () {
  var DICT = {
    en: {
      "hold.title": "Cojam is coming back.",
      "hold.body": "The new site and the token migration are in preparation. Official announcements will appear only on this domain."
    },
    ko: {
      "hold.title": "Cojam이 다시 돌아옵니다.",
      "hold.body": "새로운 사이트와 토큰 마이그레이션을 준비하고 있습니다. 공식 공지는 이 도메인에서만 안내됩니다."
    },
    ja: {
      "hold.title": "Cojamが帰ってきます。",
      "hold.body": "新しいサイトとトークン移行を準備しています。公式のお知らせはこのドメインでのみ掲載します。"
    }
  };
  var SUPPORTED = ["en", "ko", "ja"];

  function pick() {
    var q = new URLSearchParams(location.search).get("lang");
    if (SUPPORTED.indexOf(q) > -1) return q;
    var seg = location.pathname.split("/")[1];
    if (SUPPORTED.indexOf(seg) > -1) return seg;
    try { var s = localStorage.getItem("cj.lang"); if (SUPPORTED.indexOf(s) > -1) return s; } catch (e) {}
    var nav = (navigator.language || "en").slice(0, 2);
    return SUPPORTED.indexOf(nav) > -1 ? nav : "en";
  }

  function apply(lang) {
    var d = DICT[lang] || DICT.en;
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var k = el.getAttribute("data-i18n");
      el.textContent = d[k] || DICT.en[k] || el.textContent;
    });
    document.querySelectorAll("[data-lang]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === lang));
    });
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-lang]");
    if (!b) return;
    var lang = b.getAttribute("data-lang");
    try { localStorage.setItem("cj.lang", lang); } catch (err) {}
    apply(lang);
  });

  apply(pick());
})();
