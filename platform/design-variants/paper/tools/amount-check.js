// node tools/amount-check.js : the amount fields of withdraw, convert and staking share one parser and never rewrite what was entered.
// A refused key leaves the value as it was and says why; a pasted value that cannot be read stays in the field with an error and the action stays disabled.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); let n = 0; const bad = [];
  for (const [url, good] of [['withdraw.html?state=filled', '250'], ['convert.html', '1,000'], ['staking.html', '500']]) {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } }); await pg.goto('http://localhost:8851/' + url); await pg.waitForTimeout(700);
    const inp = pg.locator('#amt');
    for (const keys of ['-5', '1e5', 'abc', '1.2.3']) {
      await inp.fill(''); await inp.focus(); let said = '';
      for (const k of keys) { await pg.keyboard.type(k); const m = await pg.locator('.field-refuse').count() ? await pg.locator('.field-refuse').first().textContent() : ''; if (m) said = m; }
      const v = await inp.inputValue(), expect = { '-5': '5', '1e5': '15', 'abc': '', '1.2.3': '1.23' }[keys];   // the refused keys are missing, the accepted ones are as typed, and the reason was shown
      n++; if (v !== expect || !said) bad.push(url + ' typed "' + keys + '": value "' + v + '", reason "' + said + '"');
    }
    for (const paste of ['-5', '1e5', 'abc']) {
      await inp.evaluate((el, v) => { el.value = v; el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' })); }, paste); await pg.waitForTimeout(250);   // a paste is not filtered key by key
      const v = await inp.inputValue(), msg = (await pg.locator('#amt-msg').textContent()).trim(), off = await pg.locator('#go').isDisabled();
      n++; if (v !== paste || !msg || !off) bad.push(url + ' pasted "' + paste + '": value "' + v + '", message "' + msg + '", action disabled ' + off);
    }
    await inp.evaluate((el, v) => { el.value = v; el.dispatchEvent(new InputEvent('input', { bubbles: true })); }, good); await pg.waitForTimeout(250); n++; if (await pg.locator('#go').isDisabled()) bad.push(url + ' a good amount leaves the action disabled');
    await pg.close();
  }
  console.log(n + ' checks, ' + bad.length + ' failed'); bad.forEach(x => console.log('  ' + x)); await b.close(); process.exit(bad.length ? 1 : 0);
})();
