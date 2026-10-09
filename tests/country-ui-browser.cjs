/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS browser harness uses the project's bundled webpack. */
// Isolated local component test. Does not start the app, read .env or contact Supabase.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const { webpack } = require("next/dist/compiled/webpack/webpack");
const root = path.resolve(__dirname, "..");
fs.mkdirSync(path.join(root, ".next"), { recursive: true });
const preview = fs.mkdtempSync(path.join(root, ".next/country-ui-preview-"));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server, browser, socket;

async function run() {
  fs.writeFileSync(path.join(preview, "loader.cjs"), `module.exports = function(source) {
    if (this.resourcePath.endsWith('.css')) return 'module.exports = new Proxy({}, {get: (_, key) => key === "__esModule" ? false : String(key)})';
    return require('typescript').transpileModule(source, {compilerOptions: {module: 1, jsx: 4, target: 7, esModuleInterop: true}}).outputText;
  };`);
  fs.writeFileSync(path.join(preview, "entry.tsx"), `
    import { createRoot } from 'react-dom/client';
    import { useState } from 'react';
    import { TranslationProvider, useI18n } from '@/lib/i18n';
    import { CountrySelect, CountryMultiSelect } from '@/components/country-select';
    function Fixture() {
      const [country, setCountry] = useState('');
      const [countries, setCountries] = useState([]);
      const { setLanguage } = useI18n();
      return <main style={{maxWidth: 600, padding: 16, margin: 'auto'}}>
        <form id="fixture" onSubmit={e => { e.preventDefault(); window.saved = [...new FormData(e.currentTarget)]; }}>
          <div className="form-grid">
            <CountrySelect name="country_code" label="País" value={country} onChange={setCountry} required />
            <CountryMultiSelect name="country_codes" label="Países" values={countries} onChange={setCountries} required />
            <CountryMultiSelect name="locked" label="Locked countries" values={['MX','AR']} onChange={() => { throw new Error('Locked mutation'); }} disabled />
          </div>
          <button id="save">Save</button>
          <button id="english" type="button" onClick={() => setLanguage('en')}>English</button>
        </form>
      </main>;
    }
    createRoot(document.getElementById('root')).render(<TranslationProvider><Fixture /></TranslationProvider>);
  `);
  await new Promise((resolve, reject) => webpack({
    mode: "development", target: "web", devtool: false,
    entry: path.join(preview, "entry.tsx"), output: { path: preview, filename: "bundle.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": path.join(root, "src") } },
    module: { rules: [{ test: /\.(tsx?|css)$/, use: path.join(preview, "loader.cjs") }] },
  }, (error, stats) => error || stats.hasErrors() ? reject(error ?? new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  console.log("Browser fixture compiled.");
  const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8") + fs.readFileSync(path.join(root, "src/components/country-select.module.css"), "utf8");
  server = http.createServer((request, response) => {
    response.setHeader("Content-Type", request.url === "/bundle.js" ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8");
    response.end(request.url === "/bundle.js" ? fs.readFileSync(path.join(preview, "bundle.js")) : `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const executable = process.env.COUNTRY_TEST_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  browser = spawn(executable, ["--headless", "--no-first-run", "--disable-background-networking", "--disable-component-update", "--remote-debugging-port=0", `--user-data-dir=${preview}/browser`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  browser.on("error", (error) => { console.error(error.message); });
  const devtoolsFile = path.join(preview, "browser/DevToolsActivePort");
  for (let i = 0; !fs.existsSync(devtoolsFile) && i < 100; i++) await delay(100);
  if (!fs.existsSync(devtoolsFile)) throw new Error("Browser DevTools did not start");
  const devtoolsPort = fs.readFileSync(devtoolsFile, "utf8").split("\n")[0];
  const targets = await (await fetch(`http://127.0.0.1:${devtoolsPort}/json/list`, { signal: AbortSignal.timeout(5000) })).json();
  socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Browser WebSocket timed out")), 5000);
    socket.onopen = () => { clearTimeout(timer); resolve(); };
    socket.onerror = (error) => { clearTimeout(timer); reject(error); };
  });
  console.log("Local browser connected.");
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method} ${params.expression ?? ""}`)); }, 15000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const click = async (expression) => { await evaluate(`${expression}.click()`); await delay(80); };
  const key = async (value) => {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: value, code: value === " " ? "Space" : value, windowsVirtualKeyCode: { ArrowDown: 40, ArrowUp: 38, Escape: 27, Enter: 13, Tab: 9 }[value] ?? 0 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: value, code: value }); await delay(80);
  };
  await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/` });
  for (let i = 0; i < 100 && !await evaluate("Boolean(document.querySelector('button[aria-haspopup]'))"); i++) await delay(100);

  await click("document.querySelector('#save')");
  assert.equal(await evaluate("window.saved === undefined"), true, "Required selection blocks submit");
  assert.equal(await evaluate("document.activeElement.type"), "search", "Required validation focuses picker search");
  await send("Input.insertText", { text: "mexico" }); await delay(100);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[role=option]')].map(x=>x.textContent)"), ["México"]);
  await key("ArrowDown"); await key("Enter");
  assert.equal(await evaluate("document.querySelector('select[name=country_code]').value"), "MX");

  await click("document.querySelectorAll('button[aria-haspopup]')[1]");
  await send("Input.insertText", { text: "mexico" }); await delay(100);
  await key("ArrowDown"); await key("Enter");
  await evaluate("document.querySelector('input[type=search]').focus(); document.querySelector('input[type=search]').select()");
  await send("Input.insertText", { text: "argentina" }); await delay(100);
  await key("ArrowDown"); await key("Enter");
  await key("Escape");
  assert.equal(await evaluate("document.activeElement === document.querySelectorAll('button[aria-haspopup]')[1]"), true);
  await click("document.querySelector('#save')");
  assert.deepEqual(await evaluate("window.saved"), [["country_code", "MX"], ["country_codes", "AR"], ["country_codes", "MX"]]);
  assert.equal(await evaluate("document.querySelectorAll('button[aria-haspopup]')[2].disabled"), true);

  for (const width of [1440, 768, 375]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
    await click("document.querySelectorAll('button[aria-haspopup]')[1]");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, `No horizontal overflow at ${width}px`);
    assert.equal(await evaluate("document.querySelector('.dropdown').getBoundingClientRect().right <= innerWidth"), true, `Search fits at ${width}px`);
    await key("Escape");
  }
  await click("document.querySelector('button[aria-label=\"Quitar México\"]')");
  await click("document.querySelector('#save')");
  assert.deepEqual(await evaluate("window.saved"), [["country_code", "MX"], ["country_codes", "AR"]]);
  await click("document.querySelector('#english')");
  assert.equal(await evaluate("document.querySelector('button[aria-haspopup]').textContent"), "Mexico");
  await click("document.querySelector('button[aria-haspopup]')");
  await send("Input.insertText", { text: "argentina" }); await delay(100);
  await key("ArrowDown"); await key("Enter");
  await click("document.querySelector('#save')");
  assert.deepEqual(await evaluate("window.saved"), [["country_code", "AR"], ["country_codes", "AR"]], "Single selector permits MX to AR change");
  console.log("PASS: keyboard search/select/Escape, required validation, ISO submission, chips/removal, disabled locks, ES/EN, desktop/tablet/mobile (isolated components).");
  await send("Browser.close");
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  socket?.close(); server?.close();
  if (browser && browser.exitCode === null) browser.kill();
  await delay(1000);
  // Only remove the uniquely generated directory beneath this workspace.
  if (preview.startsWith(path.join(root, ".next") + path.sep + "country-ui-preview-")) {
    try { fs.rmSync(preview, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
    catch { console.error(`Temporary browser files remain at ${preview}`); }
  }
});
