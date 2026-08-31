const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { ProviderAdapters } = require("./load-production-modules");
const { parseProviderFixture } = ProviderAdapters;
const fixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", `${name}.json`), "utf8"));

const wallet = parseProviderFixture("muteki", fixture("muteki-wallet"), {
  now: 1_800_000_000_000,
  settings: { usdToCnyRate: 7.2 },
});
assert.equal(wallet.status, "ok");
assert.equal(wallet.value, 6.23462188);
assert.equal(wallet.unit, "$");
assert.equal(wallet.currency, "USD");
assert.equal(wallet.display, "$6.23");
assert.equal(wallet.convertedDisplay, "≈¥44.89");
assert.equal(wallet.detail, "钱包余额");
assert.equal(wallet.secondaryDetail, "今日 $0.42");
assert.deepEqual(wallet.meta, {
  source: "muteki",
  planName: "钱包余额",
  mode: "unrestricted",
  todayActualCost: 0.42,
  totalActualCost: 3.75,
  requestsToday: 12,
  totalTokensToday: 3456,
});
assert.doesNotMatch(JSON.stringify(wallet), /daily_usage|"usage"|credential/);

assert.throws(
  () => parseProviderFixture("muteki", fixture("muteki-invalid-key")),
  /API Key 无效/
);

const partial = parseProviderFixture("muteki", fixture("muteki-partial-response"));
assert.equal(partial.display, "$3.50");
assert.equal(partial.detail, "钱包余额");
assert.equal(partial.secondaryDetail, "");
assert.equal(partial.meta.todayActualCost, null);

assert.throws(
  () =>
    parseProviderFixture("muteki", {
      isValid: true,
      remaining: 8,
      balance: 5,
      unit: "USD",
    }),
  /余额响应异常/
);

console.log("muteki provider: ok");
