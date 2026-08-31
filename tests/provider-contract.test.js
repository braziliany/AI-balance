const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { ProviderAdapters } = require("./load-production-modules");
const { PROVIDERS, parseProviderFixture } = ProviderAdapters;
const fixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", `${name}.json`), "utf8"));

const cases = [
  ["deepseek", fixture("deepseek-balance"), {}],
  ["stepfun", fixture("stepfun-account"), {}],
  ["kimi", fixture("kimi-balance"), { settings: { kimiRegion: "cn" } }],
  ["codex", fixture("codex-5h-weekly"), { now: 1_800_000_000_000 }],
  ["serpbase", { credits: 321 }, {}],
];
const required = [
  "id", "name", "status", "value", "unit", "currency", "display",
  "detail", "secondaryDetail", "convertedDisplay", "renderedAt",
  "successfulFetchedAt", "cachedAt", "resetAt", "quota", "meta",
];
const privateFields = [
  "balance_infos", "total_balance", "available_balance", "used_percent",
  "primary_window", "secondary_window",
];

assert.deepEqual(
  PROVIDERS.map((provider) => provider.id),
  ["deepseek", "stepfun", "codex", "serpbase", "kimi"]
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

console.log("provider contract: ok");
