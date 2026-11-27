// node tools/make-pages.js : writes the thin HTML page of every screen (the screens are built by assets/app.js and screens/*.js).
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const pages = [
  ['login', 'Log in', 'play', 'States: (none), code, setup, bad, wrong, offline'],
  ['first-run', 'First run', 'play', 'States: (none), 2, 3, code'],
  ['home', 'Home, card view', 'play', 'States: (none) fresh, partial, last, hold, empty, loading, error, offline, closed, noimage'],
  ['home-list', 'Home, list view', 'play', 'States: (none) partial, fresh, offline'],
  ['done', 'Day done', 'play', 'States: (none), moment, saving, welcome'],
  ['results', 'Results', 'play', 'States: (none), empty, loading, error, offline'],
  ['ranking', 'Weekly ranking', 'play', 'States: (none), lastweek, none, hold, loading, error, offline'],
  ['staking', 'Staking, new stake', 'office', 'States: (none), review, done, zero, hold, loading, error, offline'],
  ['stakes', 'Staking, my stakes', 'office', 'States: (none), empty, hold, loading, error, offline'],
  ['wallet', 'Wallet', 'office', 'States: (none), deposit, withdraw, hold, loading, error, offline'],
  ['convert', 'Convert points', 'office', 'States: (none), short, wait, ok, hold'],
  ['profile', 'Profile', 'office', 'States: (none), code, logout, hold'],
  ['invite', 'Invite friends', 'office', 'States: (none), empty, hold, error'],
  ['hold', 'Account on hold', 'office', 'The notice an account sees while it is under review']
];
const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Do+Hyeon&family=M+PLUS+1p:wght@800&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-jp-dynamic-subset.min.css">
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components.css">`;
for (const [name, title, zone, states] of pages) {
  fs.writeFileSync(path.join(root, name + '.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0E1420">
<title>${title} | Cojam Daily</title>
<link rel="icon" href="assets/cojam-mark.svg" type="image/svg+xml">
${fonts}
</head>
<body data-screen="${name}" data-zone="${zone}">
<!-- ${title}. ${states} -->
<noscript>Cojam needs JavaScript to show this screen.</noscript>
<script src="assets/i18n.js"></script>
<script src="assets/md-i18n.js"></script>
<script src="assets/mock.js"></script>
<script src="assets/app.js"></script>
<script src="screens/${zone}.js"></script>
</body>
</html>
`);
}
fs.writeFileSync(path.join(root, 'tools', 'fonts.html'), fonts);
console.log(pages.length + ' pages');
