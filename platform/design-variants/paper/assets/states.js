/* Every screen and state of the Daily Paper variant, in the order a player meets them. The state names are the ones of the functional reference
   (platform/design/index.html), so the app can map them one to one; file names that differ are listed in STATES.md.
   Used by the hub (index.html) and by the tools (state check, captures, audit). Each entry: [id, title, note, file, states]. "" is the screen without a state. */
(function (root) {
  var S = [
    ["G1", "Gate", "The newsstand copy: how to get the app on this device", "gate.html", ["android", "accepted", "dismissed", "android-manual", "ios", "ios-other", "inapp", "inapp-ios", "desktop", "generic", "installed", "invited", "invited-noname", "invited-ios-other", "invited-inapp", "invited-inapp-ios"]],
    ["A1", "Log in", "The cover: email, code, setting up", "login.html", ["", "empty", "bademail", "typo", "unsupported", "toomany", "sendfail", "sending", "code", "verifying", "wrong", "short", "expired", "tries", "setup", "returning", "busy", "walletfail", "devicefail", "refused-used", "refused-provider", "refused-many", "refused", "offline"]],
    ["A2", "First run", "Three short pages, the invite code, the language", "first-run.html", ["1", "2", "3", "settingup", "code", "code-valid", "code-unknown", "code-own", "code-linked", "code-offline"]],
    ["H1", "Home, card view", "The front page: swipe, Undo, the fifth pick leads to done", "home.html", ["", "fresh", "noimage", "imagetop", "partial", "syncing", "slow", "failed", "reconnect", "reconnectfail", "otherdevice", "loading", "empty", "closed", "error", "offline", "hold"]],
    ["H2", "Home, list view", "The five questions as an index", "home-list.html", ["", "fresh", "syncing", "slow", "failed", "reconnect", "reconnectfail", "otherdevice", "loading", "empty", "closed", "error", "offline", "hold"]],
    ["H3", "Day done", "The extra edition, then the settled page", "done.html", ["", "moment", "saving", "results", "zero", "welcome", "offline"]],
    ["R1", "Results", "Box scores: stamps, rows that open in place", "results.html", ["", "open", "loading", "empty", "nowaiting", "noset", "error", "offline"]],
    ["K1", "Weekly ranking", "The league table and the prize pool", "ranking.html", ["", "how", "top10", "unranked", "winner", "short", "lastweek", "sent", "loading", "error", "offline", "hold"]],
    ["S1", "Staking, new stake", "The rates page, with the review and transaction sheets", "staking.html", ["", "empty", "below", "above", "zero", "big", "paused", "full", "fullnone", "max20", "loading", "review", "signing", "steps", "sending", "slow", "success", "failed", "hidden", "error", "offline", "hold"]],
    ["S2", "Staking, my stakes", "One entry per stake", "stakes.html", ["", "claimable", "unlocking", "claim", "loading", "empty", "error", "offline", "hold", "hold-nokaia"]],
    ["W1", "Wallet", "The accounts", "wallet.html", ["", "new", "zero", "loading", "error", "offline", "hold"]],
    ["W2", "Convert points", "Points to CT", "convert.html", ["", "empty", "step", "above", "min", "short", "wait", "cap", "capglobal", "paused", "signing", "sending", "success", "failed", "loading", "offline", "hold"]],
    ["W3", "Deposit", "The address, as a code and in full", "deposit.html", ["", "arrived", "loading", "error", "offline"]],
    ["W4", "Withdraw CT", "Where to, how much, the fee, the review", "withdraw.html", ["", "filled", "bad", "sum", "own", "contract", "nokaia", "review", "signing", "sending", "success", "failed", "loading", "offline"]],
    ["P1", "Profile", "Name, account, preferences, help", "profile.html", ["", "nameerror", "nameword", "notset", "otherdevice", "saved", "logout", "session", "update", "hold", "unranked", "help", "code-open", "code-sheet", "code-valid", "code-unknown", "code-own", "code-offline", "code-linked"]],
    ["I1", "Invite friends", "The offer, the code, the results", "invite.html", ["", "empty", "loading", "error", "offline", "copied", "shared", "hold"]],
    ["SYS", "System screens", "Maintenance, update, offline, not found, account on hold", "system.html", ["maintenance", "update", "offline", "notfound", "blocked"]]
  ];
  root.PAPER_STATES = S;
  if (typeof module !== "undefined" && module.exports) module.exports = S;
})(typeof window !== "undefined" ? window : globalThis);
