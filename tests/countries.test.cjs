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
const countries = load("src/lib/countries.ts");
const { campaignInput } = load("src/lib/campaign-input.ts");
const { parseProfileInput } = load("src/lib/profile-input.ts");
const { translations, TranslationProvider } = load("src/lib/i18n.tsx");
const { CountrySelect, CountryMultiSelect } = load("src/components/country-select.tsx");
const { CountryAvailability, CountryName } = load("src/components/country-display.tsx");
const migration = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20261008120000_country_eligibility.sql"), "utf8");

test("249 assigned ISO codes, ES/EN names, accent-insensitive search and rejection of unknowns", () => {
  assert.equal(countries.COUNTRY_CODES.length, 249);
  assert.equal(new Set(countries.COUNTRY_CODES).size, 249);
  assert.equal(countries.countryName("MX", "es"), "México");
  assert.equal(countries.countryName("DE", "es"), "Alemania");
  assert.equal(countries.countryName("DE", "en"), "Germany");
  assert.equal(countries.normalizeCountryCode(" ar "), "AR");
  for (const value of ["ZZ", "UK", "XK", "unknown", "México", "", null]) assert.equal(countries.normalizeCountryCode(value), null);
  assert.equal(countries.countrySearchText("México"), "mexico");
  for (const language of ["es", "en"]) assert.ok(countries.countryOptions(language).every((option) => option.name && option.name !== option.code));
});

test("SQL whitelist exactly matches the frontend catalog; country checks preserve join implementation", () => {
  const sqlCodes = [...migration.match(/select p_code = any\(array\[(.*?)\]/s)[1].matchAll(/'([A-Z]{2})'/g)].map((match) => match[1]);
  assert.deepEqual(sqlCodes, countries.COUNTRY_CODES);
  const oldSql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20261003204415_join_campaign.sql"), "utf8").replace(/\r\n/g, "\n");
  const start = "create or replace function public.join_campaign(";
  const getFunction = (sql) => sql.slice(sql.indexOf(start), sql.indexOf("$$;", sql.indexOf(start)) + 3);
  const newJoin = getFunction(migration);
  const withoutCountry = newJoin.replace(/  -- Country is required even for all_countries; unknown values never grant access\.[\s\S]*?(?=  -- -------------------------------------------------------)/, "");
  assert.equal(withoutCountry, getFunction(oldSql), "Existing auth, locks, capacity, duplicate, lifecycle and events must be unchanged");
  assert.match(newJoin, /raise exception 'COUNTRY_NOT_ELIGIBLE'/);
  assert.match(newJoin, /cc\.campaign_id = p_campaign_id\s+and cc\.country_code = v_profile\.country_code/);
  assert.equal((migration.match(/not public\.is_valid_country_code\(v_country_code\)/g) ?? []).length, 3, "Discovery, detail and dashboard reject invalid profile countries");
  const priorCampaignSql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20261004033650_campaign_create_and_update.sql"), "utf8").replace(/\r\n/g, "\n");
  for (const functionName of ["create_campaign", "update_campaign"]) {
    const marker = `create or replace function public.${functionName}(`;
    const body = (sql) => sql.slice(sql.indexOf(marker), sql.indexOf("$$;", sql.indexOf(marker)) + 3);
    const withoutAvailability = body(migration)
      .replace(/  -- Specific availability requires at least one selected country,[\s\S]*?(?=  insert into public\.test_campaigns)/, "")
      .replace(/  -- Check after structural locks,[\s\S]*?(?=  update public\.test_campaigns)/, "");
    assert.equal(withoutAvailability, body(priorCampaignSql), "Country availability must preserve campaign ownership, structural locks, target and lifecycle checks");
  }
});

function campaignForm(all = false, codes = []) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ platform: "android", target_testers: "2", duration_days: "14", min_os_major: "", min_os_minor: "", all_countries: all ? "on" : "off" })) form.set(key, value);
  for (const code of codes) form.append("country_codes", code);
  return form;
}
test("campaign accepts all without list, repeated multiselect values and deduplication; rejects invalid/empty", () => {
  assert.deepEqual(campaignInput(campaignForm(true), true).fields.p_country_codes, []);
  assert.equal(campaignInput(campaignForm(true), true).fields.p_all_countries, true);
  assert.deepEqual(campaignInput(campaignForm(false, ["MX", "AR", "MX"]), true).fields.p_country_codes, ["MX", "AR"]);
  assert.equal(campaignInput(campaignForm(false, ["ZZ"]), true).error, "countries");
  assert.equal(campaignInput(campaignForm(false), true).error, "countries");
  assert.equal(campaignInput(campaignForm(false, ["México"]), true).error, "countries");
  const locked = campaignInput(campaignForm(false, ["DE"]), false).fields;
  assert.equal(Object.hasOwn(locked, "p_country_codes"), false);
  assert.equal(Object.hasOwn(locked, "p_all_countries"), false);
});

test("profile persists normalized MX/AR and rejects arbitrary code/name/empty", () => {
  const form = new FormData();
  form.set("testing_email", "tester@example.test");
  form.set("initial_intent", "tester");
  form.set("devices", JSON.stringify([{ platform: "android", os_major: 24 }]));
  for (const [raw, expected] of [[" mx ", "MX"], ["AR", "AR"]]) {
    form.set("country_code", raw); assert.equal(parseProfileInput(form).input.country_code, expected);
  }
  for (const raw of ["ZZ", "México", ""]) {
    form.set("country_code", raw); assert.equal(parseProfileInput(form).error, "country");
  }
});

function render(component, props) { return renderToStaticMarkup(createElement(TranslationProvider, null, createElement(component, props))); }
test("selectors submit ISO values, display localized names and retain disabled structural selections", () => {
  const single = render(CountrySelect, { name: "country_code", label: "País", value: "MX", onChange() {}, required: true });
  assert.match(single, /value="MX" selected=""/);
  assert.match(single, /<span>México<\/span>/);
  const multi = render(CountryMultiSelect, { name: "country_codes", label: "Países", values: ["MX", "AR", "MX"], onChange() {}, disabled: true, required: true });
  assert.match(multi, /value="MX" selected=""/);
  assert.match(multi, /value="AR" selected=""/);
  assert.equal((multi.match(/aria-label="Quitar México"/g) ?? []).length, 1);
  assert.match(multi, /name="country_codes" multiple="" required="" disabled=""/);
  assert.match(multi, /aria-expanded="false"/);
  assert.ok(!single.includes('name="query"'), "Search text is never a submitted field");
});

test("country displays localize codes, summarize large lists and cover all countries", () => {
  assert.equal(render(CountryName, { code: "MX" }), "México");
  assert.equal(render(CountryAvailability, { all: false, codes: ["MX", "AR"] }), "México, Argentina");
  assert.equal(render(CountryAvailability, { all: false, codes: ["MX", "AR", "DE", "ES", "US"] }), "5 países");
  assert.equal(render(CountryAvailability, { all: true, codes: [] }), "Todos los países");
  assert.deepEqual(Object.keys(translations.es).sort(), Object.keys(translations.en).sort());
});
