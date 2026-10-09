/* eslint-disable @typescript-eslint/no-require-imports -- Static SQL regression checks require no additional dependency. */
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const read=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8').replace(/\r\n/g,'\n');
const old=read('supabase/migrations/20261005110000_participation_feedback.sql');
const next=read('supabase/migrations/20261009180000_feedback_authorize_before_normalize.sql');
const body=(sql,name)=>{const start=sql.indexOf('create or replace function public.'+name+'(');return sql.slice(start,sql.indexOf('end $$;',start)+7);};
for(const name of ['add_participation_feedback','update_participation_feedback']) {
  test(name+' preserves behavior while deferring text normalization past ownership',()=>{
    const fn=body(next,name);
    const expression="regexp_replace(p_feedback_text, '^[[:space:]]+|[[:space:]]+$', '', 'g')";
    const restored=fn.replace('v_text text;',()=>`v_text text := ${expression};`)
      .replace(`  -- Normalize only after the initial actor checks, before retaining campaign locks.\n  v_text := ${expression};\n`,'');
    assert.equal(restored,body(old,name));
    const normalization=fn.indexOf('  v_text :=');
    assert.ok(fn.indexOf("raise exception 'NOT_AUTHENTICATED'")<normalization);
    assert.ok(fn.indexOf("raise exception 'NOT_PARTICIPATION_OWNER'")<normalization);
    assert.ok(normalization<fn.indexOf('  perform 1 from public.test_campaigns'));
    assert.match(fn,/v_user uuid := auth\.uid\(\)/);
  });
}
test('change adds no quotas, rate limiter, resource permissions, table or event type',()=>{
  assert.equal((next.match(/create or replace function/g)??[]).length,2);
  assert.doesNotMatch(next,/create table|create trigger|grant |revoke |RATE_LIMITED|pg_sleep|interval '/i);
});
