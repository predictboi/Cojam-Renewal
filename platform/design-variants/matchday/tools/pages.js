// The list of screens and states shared by the capture and audit scripts: [name used in the capture file, page with query].
module.exports = [
  ['login', 'login.html'], ['login-code', 'login.html?state=code'], ['login-setup', 'login.html?state=setup'], ['login-bad', 'login.html?state=bad'],
  ['first-run', 'first-run.html'], ['first-run-2', 'first-run.html?state=2'], ['first-run-3', 'first-run.html?state=code'],
  ['home', 'home.html'], ['home-partial', 'home.html?state=partial'], ['home-hold', 'home.html?state=hold'], ['home-empty', 'home.html?state=empty'], ['home-loading', 'home.html?state=loading'], ['home-error', 'home.html?state=error'], ['home-offline', 'home.html?state=offline'], ['home-noimage', 'home.html?state=noimage'],
  ['home-list', 'home-list.html'], ['home-list-fresh', 'home-list.html?state=fresh'],
  ['done', 'done.html'], ['done-saving', 'done.html?state=saving'], ['done-welcome', 'done.html?state=welcome'],
  ['results', 'results.html'], ['results-empty', 'results.html?state=empty'],
  ['ranking', 'ranking.html'], ['ranking-lastweek', 'ranking.html?state=lastweek'], ['ranking-none', 'ranking.html?state=none'], ['ranking-hold', 'ranking.html?state=hold'],
  ['staking', 'staking.html'], ['staking-review', 'staking.html?state=review'], ['staking-done', 'staking.html?state=done'], ['staking-hold', 'staking.html?state=hold'],
  ['stakes', 'stakes.html'], ['stakes-empty', 'stakes.html?state=empty'],
  ['wallet', 'wallet.html'], ['wallet-deposit', 'wallet.html?state=deposit'], ['wallet-withdraw', 'wallet.html?state=withdraw'], ['wallet-hold', 'wallet.html?state=hold'],
  ['convert', 'convert.html'], ['convert-short', 'convert.html?state=short'], ['convert-wait', 'convert.html?state=wait'], ['convert-ok', 'convert.html?state=ok'],
  ['profile', 'profile.html'], ['profile-logout', 'profile.html?state=logout'], ['invite', 'invite.html'], ['invite-empty', 'invite.html?state=empty'], ['hold', 'hold.html'], ['index', 'index.html']
];
