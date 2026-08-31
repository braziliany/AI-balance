const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { ProviderAdapters } = require("./load-production-modules");
const { PROVIDERS, parseProviderFixture } = ProviderAdapters;
const fixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", `${name}.json`), "utf8"));

const cases = [
  ["deepseek", fixture("deepseek-balance"), {}],
  ["codex", fixture("codex-5h-weekly"), { now: 1_800_000_000_000 }],
  ["muteki", fixture("muteki-wallet"), { settings: { usdToCnyRate: 7.2 } }],
];
const required = [
  "id", "name", "status", "value", "unit", "currency", "display",
  "detail", "secondaryDetail", "convertedDisplay", "renderedAt",
  "successfulFetchedAt", "cachedAt", "resetAt", "quota", "meta",
];
const privateFields = [
  '"balance_infos"\\s*:', '"total_balance"\\s*:',
  '"available_balance"\\s*:', '"used_percent"\\s*:',
  '"primary_window"\\s*:', '"secondary_window"\\s*:',
  '"remaining"\\s*:', '"daily_usage"\\s*:', '"usage"\\s*:',
];

assert.deepEqual(
  PROVIDERS.map((provider) => provider.id),
  ["deepseek", "codex", "muteki"]
);
for (const [providerId, response, context] of cases) {
  const result = parseProviderFixture(providerId, response, context);
  for (const field of required) {
    assert.ok(Object.hasOwn(result, field), `${providerId} 缺少 ${field}`);
    assert.notEqual(result[field], undefined, `${providerId}.${field} 为 undefined`);
  }
  assert.equal(Number.isFinite(result.value), true, `${providerId}.value 不是有限数`);
  assert.equal(typeof result.display, "string");
  const serialized = JSON.stringify(result);
  for (const field of privateFields) {
    assert.doesNotMatch(serialized, new RegExp(field), `${providerId} 泄漏 ${field}`);
  }
}

const deepseekResult = parseProviderFixture("deepseek", fixture("deepseek-balance"));
assert.equal(deepseekResult.secondaryDetail, "");
assert.doesNotMatch(JSON.stringify(deepseekResult), /granted_balance|赠送/);

console.log("provider contract: ok");
