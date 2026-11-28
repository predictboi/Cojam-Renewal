// node tools/make-pages.js : writes the thin HTML loader for every screen (each screen is rendered by screens/<name>.js).
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const pages = { 'index': ['Hub', 'hub'], 'login': ['Log in', 'login'], 'first-run': ['First run', 'first-run'], 'home': ['Home, card view', 'home'], 'home-list': ['Home, list view', 'home'],
  'done': ['Day done', 'done'], 'results': ['Results', 'results'], 'ranking': ['Weekly ranking', 'ranking'], 'staking': ['Staking, new stake', 'staking'], 'stakes': ['My stakes', 'staking'],
  'wallet': ['Wallet', 'wallet'], 'convert': ['Convert points', 'convert'], 'profile': ['Profile', 'profile'], 'invite': ['Invite friends', 'invite'], 'hold': ['Account on hold', 'hold'] };
for (const [name, [title, js]] of Object.entries(pages)) {
  fs.writeFileSync(path.join(root, name + '.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#F2F0E9">
<title>${title} | Cojam Daily, Poster</title>
<link rel="icon" href="assets/cojam-mark.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500..900&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-jp-dynamic-subset.min.css">
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components.css">
</head>
<body data-page="${name}">
<noscript>Cojam needs JavaScript to show this screen.</noscript>
<script src="assets/i18n.js"></script>
<script src="assets/poster-i18n.js"></script>
<script src="assets/mock.js"></script>
<script src="assets/app.js"></script>
<script src="screens/${js}.js"></script>
</body>
</html>
`);
}
console.log('pages written');
