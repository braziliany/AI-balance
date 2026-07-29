const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const widgetPath = path.join(__dirname, "..", "AI-Balance.js");
const source = fs
  .readFileSync(widgetPath, "utf8")
  .replace(
    "await main();",
    `globalThis.__widgetTestApi = {
      CONFIG,
      changeText,
      isLowBalance,
      orderedProviders,
      parseCodexQuota,
      parseDeepSeekBalance,
      parseKimiBalance,
      parseStepFunBalance,
      remainingPercent,
    };`
  );
const context = {
  importModule: () => ({
    resolvePalette: () => ({}),
    applyCardBackground: () => {},
  }),
};
vm.runInNewContext(source, context, { filename: widgetPath });

const api = context.__widgetTestApi;
const fixture = (name) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, "fixtures", `${name}.json`), "utf8")
  );

assert.equal(api.parseDeepSeekBalance(fixture("deepseek-balance")).display, "¥22.82");
assert.equal(api.parseStepFunBalance(fixture("stepfun-account")).value, 15);
assert.equal(api.parseKimiBalance(fixture("kimi-balance"), "CNY").display, "¥8.07");
const codex = api.parseCodexQuota(fixture("codex-usage"));
assert.equal(codex.display, "77%");
assert.match(codex.detail, /59%/);

assert.equal(api.remainingPercent({ used_percent: 23.4 }), 77);
assert.equal(api.remainingPercent({ used_percent: 120 }), 0);
assert.equal(api.remainingPercent({}), null);

const ordered = api.orderedProviders({
  providerOrder: ["kimi", "codex", "deepseek", "stepfun", "serpbase"],
  hiddenProviders: ["stepfun", "serpbase"],
});
assert.deepEqual(
  Array.from(ordered, (provider) => provider.id),
  ["kimi", "codex", "deepseek"]
);

const thresholds = {
  lowMoneyThreshold: 10,
  lowQuotaThreshold: 20,
  lowCreditsThreshold: 100,
};
assert.equal(
  api.isLowBalance({ status: "ok", unit: "¥", value: 8 }, thresholds),
  true
);
assert.equal(
  api.isLowBalance({ status: "ok", unit: "%", value: 21 }, thresholds),
  false
);
assert.equal(
  api.isLowBalance({ status: "cached", unit: "次", value: 100 }, thresholds),
  true
);
assert.equal(
  api.isLowBalance({ status: "error", unit: "¥", value: 0 }, thresholds),
  false
);
assert.equal(api.changeText(-2.5, "¥"), "↓¥2.50");
assert.equal(api.changeText(7, "%"), "↑7%");

console.log("widget core: ok");
