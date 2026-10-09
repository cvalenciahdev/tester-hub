/* eslint-disable @typescript-eslint/no-require-imports -- Static SQL regression checks use Node without extra dependencies. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { test } = require("node:test");
const read = (file) => fs.readFileSync(path.resolve(__dirname, "..", file), "utf8").replace(/\r\n/g, "\n");
const prior = read("supabase/migrations/20261008120000_country_eligibility.sql");
const next = read("supabase/migrations/20261009120000_target_reduction_completion.sql");
const marker = "create or replace function public.update_campaign(";
const body = (sql) => sql.slice(sql.indexOf(marker), sql.indexOf("$$;", sql.indexOf(marker)) + 3);

test("new migration changes only update_campaign and preserves all existing checks", () => {
  assert.equal((next.match(/create or replace function/g) ?? []).length, 1);
  const addition = /  -- Reuse the central evaluator[\s\S]*?(?=  return v_campaign;)/;
  assert.match(body(next), addition);
  assert.equal(body(next).replace(addition, ""), body(prior));
  const acl = "revoke all\non function public.update_campaign(";
  assert.equal(next.slice(next.indexOf(acl)), prior.slice(prior.indexOf(acl)));
});

test("reevaluation follows all mutations under campaign lock and returns the helper's final row", () => {
  const fn = body(next);
  const lock = fn.indexOf("for update;");
  const update = fn.indexOf("  update public.test_campaigns");
  const lastCountryMutation = fn.lastIndexOf("insert into public.campaign_countries");
  const evaluation = fn.indexOf("perform public._evaluate_campaign_completion(p_campaign_id);");
  assert.ok(lock < update && update < lastCountryMutation && lastCountryMutation < evaluation);
  assert.match(fn.slice(evaluation), /select \*\s+into v_campaign\s+from public\.test_campaigns\s+where id = p_campaign_id;\s+end if;\s+return v_campaign;/);
  assert.equal((fn.match(/for update;/g) ?? []).length, 1, "No new participation lock or inverse lock order");
  assert.equal((fn.match(/perform public\._evaluate_campaign_completion/g) ?? []).length, 1);
  assert.match(fn.slice(fn.indexOf("  -- Reuse the central evaluator")), /if p_target_testers is not null then/);
});

test("helper remains central and completion from last participation retains its existing invocation", () => {
  assert.doesNotMatch(next, /create or replace function public\._evaluate_campaign_completion/);
  assert.doesNotMatch(next, /set\s+status\s*=\s*'completed'|completed_at\s*=|insert into public\.participation_events/i);
  const lifecycle = read("supabase/migrations/20261003221616_campaign_lifecycle.sql");
  const helper = lifecycle.slice(lifecycle.indexOf("create or replace function public._evaluate_campaign_completion("), lifecycle.indexOf("$$;") + 3);
  assert.match(helper, /v_campaign\.status <> 'testing'/);
  assert.match(helper, /tp\.status in \('waiting_access', 'access_enabled', 'active'\)/);
  assert.match(helper, /tp\.status = 'completed'/);
  assert.match(helper, /v_completed_count >= v_campaign\.target_testers/);
  const completion = read("supabase/migrations/20261005120000_complete_participation_feedback.sql");
  assert.match(completion, /perform public\._evaluate_campaign_completion\(v_participation\.campaign_id\)/);
});
