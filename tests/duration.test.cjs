/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness loads TS without adding a runtime dependency. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { test } = require("node:test");
const { renderToStaticMarkup } = require("react-dom/server");
const { createElement } = require("react");

// Use the project's existing TypeScript compiler; no test dependency or emitted files.
const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, "..", relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = mod.require.bind(mod);
  mod.require = (specifier) => {
    if (specifier.endsWith(".module.css")) return new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) });
    if (specifier.startsWith("@/")) {
      const base = `src/${specifier.slice(2)}`;
      return load(fs.existsSync(path.resolve(__dirname, "..", `${base}.ts`)) ? `${base}.ts` : `${base}.tsx`);
    }
    return originalRequire(specifier);
  };
  cache.set(filename, mod);
  mod._compile(compiled, filename);
  return mod.exports;
}

const { campaignInput, campaignError } = load('src/lib/campaign-input.ts');
const { CampaignDuration } = load('src/components/campaign-duration.tsx');
const { TranslationProvider, translations } = load('src/lib/i18n.tsx');
const { parseDuration } = load('src/lib/campaign-duration.ts');
const render = (platform, value, disabled=false) => renderToStaticMarkup(createElement(TranslationProvider, null,
  createElement(CampaignDuration, {platform, value, disabled, locked:disabled, onChange() {}})));
function form(platform, value) {
  const f=new FormData();
  for(const [key,v] of Object.entries({platform,duration_days:value,target_testers:'2',all_countries:'on',min_os_major:'',min_os_minor:''})) f.set(key,v);
  return f;
}
test('Android presets plus Custom; iOS presets without Custom; legacy values are visible', () => {
  const android=render('android','14'), ios=render('ios','90');
  for(const days of [7,14,21,30,45,60,90]) assert.ok(android.includes('value="'+days+'"'));
  assert.match(android, /value="custom"/); assert.doesNotMatch(ios, /value="custom"/);
  assert.match(render('android','120'), /value="custom" selected=""/);
  assert.match(render('android','120'), /name="duration_days".*value="120"/);
  assert.ok(render('ios','10').includes('10 días (actual)'));
  assert.ok(render('ios','91',true).includes('91 días (inválido)'));
});
test('server-side inputs reject zero/fractions and iOS 91; allow Android custom and iOS90', () => {
  assert.equal(campaignInput(form('android','120'),true).fields.p_duration_days,120);
  assert.equal(campaignInput(form('android','1'),true).fields.p_duration_days,1);
  assert.equal(campaignInput(form('android','0'),true).error,'duration');
  assert.equal(campaignInput(form('ios','90'),true).fields.p_duration_days,90);
  assert.equal(campaignInput(form('ios','91'),true).error,'iosDuration');
  assert.equal(campaignInput(form('ios','120'),true).error,'iosDuration');
  for(const value of ['-1','1.5','', 'Infinity', '2147483648']) assert.equal(parseDuration(value),null);
  assert.equal(Object.hasOwn(campaignInput(form('ios','91'),false).fields,'p_duration_days'),false);
});
test('new RPC bodies preserve previous behavior outside duration checks, including autoclosure', () => {
  const read=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8').replace(/\r\n/g,'\n');
  const next=read('supabase/migrations/20261009140000_platform_duration.sql');
  const body=(source,name)=>{const start=source.indexOf('create or replace function public.'+name+'(');return source.slice(start,source.indexOf('$$;',start)+3);};
  const create=body(next,'create_campaign').replace(/  if p_platform = 'ios' and p_duration_days > 90 then[\s\S]*?end if;\n\n/,'');
  const update=body(next,'update_campaign').replace(/  -- Unlocked legacy durations[\s\S]*?(?=  -- Check after structural locks)/,'');
  assert.equal(create,body(read('supabase/migrations/20261008120000_country_eligibility.sql'),'create_campaign'));
  assert.equal(update,body(read('supabase/migrations/20261009120000_target_reduction_completion.sql'),'update_campaign'));
});

test('range error has stable frontend mapping and localized technical messages', () => {
  assert.equal(campaignError({message:'DURATION_OUT_OF_RANGE'}), 'durationRange');
  assert.equal(translations.es['duration.outOfRange'], 'La duración seleccionada es demasiado grande para procesarse de forma segura.');
  assert.equal(translations.en['duration.outOfRange'], 'The selected duration is too large to process safely.');
  assert.ok(Number.isFinite(Date.parse('9999-12-31T00:00:00+00:00')));
  assert.ok(!Number.isFinite(Date.parse('10000-01-01T00:00:00+00:00')));
});

test('safe date helper is reused and preserves previous RPC bodies outside the technical guard', () => {
  const read=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8').replace(/\r\n/g,'\n');
  const next=read('supabase/migrations/20261009160000_safe_participation_duration.sql');
  const prior=read('supabase/migrations/20261009140000_platform_duration.sql');
  const body=(source,name)=>{const start=source.indexOf('create or replace function public.'+name+'(');return source.slice(start,source.indexOf('$$;',start)+3);};
  const create=body(next,'create_campaign').replace(/  -- Reject dates outside[\s\S]*?(?=  if p_min_os_minor)/,'');
  const update=body(next,'update_campaign').replace(/  -- Locked unchanged legacy durations stay untouched[\s\S]*?(?=  -- Check after structural locks)/,'');
  assert.equal(create,body(prior,'create_campaign'));
  assert.equal(update,body(prior,'update_campaign'));
  const confirm=body(next,'confirm_installation').replace('public._safe_participation_end_at(v_installed_at, v_campaign.duration_days)', 'v_installed_at\n      + make_interval(days => v_campaign.duration_days)');
  assert.equal(confirm,body(read('supabase/migrations/20261003221616_campaign_lifecycle.sql'),'confirm_installation'));
  assert.equal((next.match(/make_interval\(/g)??[]).length,1, 'Date arithmetic is centralized');
});
