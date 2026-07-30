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
      formatAmount,
      formatAge,
      applyHistory,
      historicalValue,
      isLowBalance,
      orderedProviders,
      parseCodexQuota,
      parseDeepSeekBalance,
      parseKimiBalance,
      parseStepFunBalance,
      remainingPercent,
      resolveProviderFailure,
      settingsPageHTML,
    };`
  );
const context = {
  importModule: () => ({
    resolvePalette: () => ({}),
    applyCardBackground: () => {},
  }),
  Keychain: {
    contains: () => true,
    get: () => "sk-test-secret",
  },
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
const weeklyOnlyCodex = api.parseCodexQuota({
  rate_limit: {
    primary_window: { used_percent: 71, window_minutes: 10080 },
  },
});
assert.equal(weeklyOnlyCodex.display, "29%");
assert.equal(weeklyOnlyCodex.detail, "周剩余");
assert.equal(api.formatAmount(12345.67), "12,346");
assert.equal(api.formatAge(0), "无成功记录");
assert.equal(
  api.parseKimiBalance(fixture("kimi-balance"), "USD", 7.2).convertedDisplay,
  "≈¥58.10"
);

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

const settingsHTML = api.settingsPageHTML({
  ...api.CONFIG,
  codexAccountId: "account-test",
});
assert.match(settingsHTML, /设置中心/);
assert.match(settingsHTML, /账户与额度/);
assert.match(settingsHTML, /显示服务与顺序/);
assert.match(settingsHTML, /刷新品牌图标/);
assert.match(settingsHTML, /经典设置菜单/);
assert.doesNotMatch(settingsHTML, /sk-test-secret/);

const provider = { id: "deepseek", name: "DeepSeek", color: "yellow" };
const freshCache = {
  id: "deepseek",
  value: 22.82,
  display: "¥22.82",
  detail: "充值 ¥22.82",
  updatedAt: 10_000,
};
const cachedFallback = api.resolveProviderFailure(
  provider,
  freshCache,
  11_000,
  24,
  new Error("HTTP 429")
);
assert.equal(cachedFallback.status, "cached");
assert.equal(cachedFallback.display, "¥22.82");
assert.equal(cachedFallback.detail, "缓存数据");

const expiredFallback = api.resolveProviderFailure(
  provider,
  freshCache,
  10_000 + 25 * 3_600_000,
  24,
  new Error("密钥失效")
);
assert.equal(expiredFallback.status, "error");
assert.equal(expiredFallback.display, "异常");
assert.equal(expiredFallback.detail, "密钥失效");

const emptyFallback = api.resolveProviderFailure(
  provider,
  null,
  11_000,
  24,
  new Error("网络不可用")
);
assert.equal(emptyFallback.status, "error");
assert.equal(emptyFallback.detail, "网络不可用");

const history = {
  deepseek: [
    { at: 1000, value: 20, unit: "¥" },
    { at: 2000, value: 18, unit: "¥" },
  ],
};
assert.equal(api.historicalValue(history.deepseek, 1500), 20);
assert.equal(api.historicalValue(history.deepseek, 500), null);
const now = 8 * 24 * 60 * 60 * 1000;
const day = 24 * 60 * 60 * 1000;
const historyWithPeriods = {
  deepseek: [
    { at: now - 7 * day - 1000, value: 30, unit: "¥" },
    { at: now - day - 1000, value: 25, unit: "¥" },
  ],
};
const resultWithHistory = [
  { id: "deepseek", status: "ok", value: 22.82, unit: "¥" },
];
api.applyHistory(resultWithHistory, historyWithPeriods, now);
assert.equal(resultWithHistory[0].periodDetail, "日 ↓¥2.18 · 周 ↓¥7.18");
assert.equal(historyWithPeriods.deepseek.at(-1).value, 22.82);

console.log("widget core: ok");
