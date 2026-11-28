# How to preview the design

The design is static HTML, CSS and vanilla JS with mock data. Nothing to install and nothing to build. Fonts (Archivo, Pretendard) load from Google Fonts and jsDelivr, so use a network connection; without one the screens fall back to system fonts.

## Run it

```sh
unzip cojam-design-kit.zip -d cojam-design-kit
cd cojam-design-kit
python3 -m http.server 8811 -d design
```

Then open:

- `http://localhost:8811/index.html`: the PWA hub. Every screen and every state, one tap each. Choose EN, 한국어 or 日本語 at the top first. View it at phone size (390 x 844 in the browser's device toolbar); on a wide screen the app sits in a 430 px column on a dark stage.
- `http://localhost:8811/components.html`: the component library with the tokens.
- `http://localhost:8811/admin/hub.html`: the admin hub. The admin is English only and built for 1024 px and wider (1440 x 900 is the reference size).

Open the pages through the server, not as files: the screens read `?lang=` and `?state=` from the URL and load their scripts by relative path.

## URL options

- `?lang=en|ko|ja`: the language of a PWA screen (English is the source). The choice is remembered in the browser.
- `?state=<name>`: one state of a screen, for example `home-cards.html?state=offline`, `staking.html?state=review`, `wallet.html?state=hold`, `system.html?state=blocked`, `admin/players.html?state=block`. Every state name is listed as a chip on the two hubs and in the comment at the top of each HTML file.
- `home-cards.html?state=fresh`: a clean set of five cards (the default continues the picks made in this browser tab).
- Admin only: `?env=kairos` shows the test network badge; `?role=viewer` or `?role=owner` shows the other roles.

## Swipe and keys

On the home screen drag a card left or right (or tap an answer, or press the arrow keys); Undo with the button, Z or Backspace within 3 seconds. Mock transactions in the staking and wallet screens run through the whole sheet flow with real waits.

## Screenshots and audit

- `screens/` holds fresh captures: the PWA at 390 x 844 (device scale 2) in English, the admin at 1440 x 900.
- `tools/audit.js` is the audit script of the guide's section 8.3. It needs Node and Playwright with Chromium: `node tools/audit.js http://localhost:8811/wallet.html 390 844 --mobile`.
