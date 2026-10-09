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
    import {createRoot} from 'react-dom/client';
    import {useState} from 'react';
    import {TranslationProvider} from '@/lib/i18n';
    import {CampaignDuration} from '@/components/campaign-duration';
    function Fixture() {
      const [platform,setPlatform]=useState('android'); const [value,setValue]=useState('120');
      return <form id="fixture" style={{maxWidth:600,padding:16}} onSubmit={e=>{e.preventDefault();window.saved=[...new FormData(e.currentTarget)];}}>
        <select id="platform" value={platform} onChange={e=>setPlatform(e.target.value)}><option>android</option><option>ios</option></select>
        <CampaignDuration platform={platform} value={value} onChange={setValue}/>
        <button id="save">Save</button>
      </form>;
    }
    createRoot(document.getElementById('root')).render(<TranslationProvider><Fixture/>);
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
  await send("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/` });
  for (let i = 0; i < 100 && !await evaluate("Boolean(document.querySelector('#platform'))"); i++) await delay(100);


  const changeSelect=async(selector,value)=>{await evaluate(`document.querySelector('${selector}').value='${value}';document.querySelector('${selector}').dispatchEvent(new Event('change',{bubbles:true}))`);await delay(100);};
  assert.equal(await evaluate("document.querySelector('.field select').value"),'custom');
  assert.equal(await evaluate("document.querySelector('input[name=duration_days]').value"),'120');
  await click("document.querySelector('#save')");
  assert.deepEqual(await evaluate('window.saved'),[['duration_days','120']]);
  await evaluate("document.querySelector('input[name=duration_days]').focus(); document.querySelector('input[name=duration_days]').select()");
  await send('Input.insertText',{text:'0'});await delay(100);
  assert.equal(await evaluate("document.querySelector('input[name=duration_days]').checkValidity()"),false);
  await evaluate("document.querySelector('input[name=duration_days]').select()");
  await send('Input.insertText',{text:'120'});await delay(100);
  await changeSelect('#platform','ios');
  assert.equal(await evaluate("[...document.querySelector('.field select').options].some(x=>x.value==='custom')"),false);
  assert.equal(await evaluate("document.querySelector('.field select').value"),'120');
  assert.equal(await evaluate("document.querySelector('.field select').getAttribute('aria-invalid')"),'true');
  assert.ok(await evaluate("document.querySelector('[role=alert]').textContent.includes('90')"));
  await evaluate('window.saved=undefined');
  await click("document.querySelector('#save')");
  assert.equal(await evaluate('window.saved===undefined'),true,'Invalid iOS duration cannot submit');
  await changeSelect('.field select','90');
  await click("document.querySelector('#save')");
  assert.deepEqual(await evaluate('window.saved'),[['duration_days','90']]);
  console.log('PASS duration browser: Android custom120, custom0 invalid, switch to iOS preserves invalid120 and requires explicit valid selection, iOS90, no iOS Custom.');
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
