/* eslint-disable @typescript-eslint/no-require-imports -- Execute real TS actions with local service doubles, without app credentials. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { test } = require('node:test');
const appId = '71000000-0000-4000-8000-000000000001';
const campaignId = '72000000-0000-4000-8000-000000000001';
const calls = [];
let locked = false;
const mocks = {
  'next/cache': { revalidatePath() {} },
  'next/navigation': { redirect(url) { throw new Error(`REDIRECT:${url}`); } },
  '@/lib/auth': { async getCurrentUser() { return { id: 'owner' }; } },
  '@/lib/apps': { isAppId: (id) => typeof id === 'string' && /^[\da-f-]{36}$/i.test(id) },
  '@/lib/own-campaigns': { async getOwnCampaign() { return { app_id: appId, has_participations: locked, min_os_major: 17, min_os_minor: 2, status: 'draft' }; } },
  '@/lib/supabase/server': { async createClient() { return { async rpc(name, params) { calls.push({ name, params }); return { data: { id: campaignId }, error: null }; } }; } },
};
const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const baseRequire = mod.require.bind(mod);
  mod.require = (specifier) => {
    if (mocks[specifier]) return mocks[specifier];
    if (specifier.startsWith('@/')) return load(`src/${specifier.slice(2)}.ts`);
    return baseRequire(specifier);
  };
  cache.set(filename, mod);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
  return mod.exports;
}
const { createCampaign, mutateCampaign } = load('src/app/(workspace)/campaigns/actions.ts');
const { campaignInput } = load('src/lib/campaign-input.ts');
function form(platform, operation) {
  const input = new FormData();
  for (const [key, value] of Object.entries({ platform, operation, duration_days: platform === 'ios' ? '90' : '14', target_testers: '2', all_countries: 'on', store_url: '', instructions: 'Updated instructions' })) input.set(key, value);
  return input;
}
test('create/draft/publish without OS fields sends explicit nulls, retains duration validation', async () => {
  for (const platform of ['android', 'ios']) {
    for (const operation of ['save', 'publish']) {
      calls.length = 0; locked = false;
      await assert.rejects(createCampaign(appId, form(platform, operation)), /REDIRECT:/);
      assert.equal(calls[0].name, 'create_campaign');
      assert.equal(calls[0].params.p_min_os_major, null);
      assert.equal(calls[0].params.p_min_os_minor, null);
      assert.equal(calls[0].params.p_duration_days, platform === 'ios' ? 90 : 14);
      assert.deepEqual(calls.map((call) => call.name), operation === 'publish' ? ['create_campaign', 'publish_campaign'] : ['create_campaign']);
    }
  }
});
test('edit draft/save-and-publish omits legacy OS fields and set flags, including manipulated form fields', async () => {
  for (const operation of ['save', 'save-and-publish']) {
    for (const hasParticipations of [false, true]) {
      calls.length = 0; locked = hasParticipations;
      const input = form('android', operation);
      input.set('min_os_major', ''); input.set('min_os_minor', '999');
      await assert.rejects(mutateCampaign(campaignId, input), /REDIRECT:/);
      const params = calls[0].params;
      for (const key of ['p_min_os_major', 'p_min_os_minor', 'p_min_os_major_set', 'p_min_os_minor_set']) assert.equal(Object.hasOwn(params, key), false);
      if (locked) assert.equal(Object.hasOwn(params, 'p_duration_days'), false);
      assert.deepEqual(calls.map((call) => call.name), operation === 'save-and-publish' ? ['update_campaign', 'publish_campaign'] : ['update_campaign']);
    }
  }
});
test('removed OS controls are unnecessary; existing iOS bounds remain', () => {
  assert.equal(campaignInput(form('android', 'save'), true).fields.p_duration_days, 14);
  const input = form('ios', 'save'); input.set('duration_days', '91');
  assert.equal(campaignInput(input, true).error, 'iosDuration');
});
