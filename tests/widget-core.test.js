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
      applyWebSettings,
      diagnosticReport,
      formatAge,
      loadSettings,
      orderedProviders,
      settingsPageHTML,
    };`
  );
const { Core, ProviderAdapters } = require("./load-production-modules");
const storedSettings = JSON.stringify({
  settingsVersion: 8,
  themeMode: "light",
  providerOrder: ["kimi", "codex", "deepseek", "stepfun", "serpbase"],
  hiddenProviders: ["kimi", "deepseek", "serpbase"],
  cacheHours: 48,
  codexAccountId: "account-settings",
  kimiRegion: "international",
  serpBaseCredits: 300,
  lowMoneyThreshold: 12,
  lowCreditsThreshold: 100,
});
const context = {
  importModule: (name) => {
    if (name === "AI-Balance-Core") return Core;
    if (name === "AI-Balance-Providers") return ProviderAdapters;
    return { resolvePalette: () => ({}), applyCardBackground: () => {} };
  },
  Keychain: {
    contains: () => true,
    get: () => "sk-test-secret",
  },
  FileManager: {
    local: () => ({
      documentsDirectory: () => "/documents",
      joinPath: (left, right) => `${left}/${right}`,
      fileExists: () => true,
      readString: () => storedSettings,
      writeString: () => {},
    }),
  },
};
vm.runInNewContext(source, context, { filename: widgetPath });

const api = context.__widgetTestApi;
const migratedSettings = api.loadSettings();
assert.equal(migratedSettings.themeMode, "light");
assert.equal(migratedSettings.cacheHours, 48);
assert.equal(migratedSettings.codexAccountId, "account-settings");
assert.equal(migratedSettings.settingsVersion, 9);
assert.deepEqual(
  Array.from(migratedSettings.providerOrder),
  ["codex", "deepseek", "muteki"]
);
assert.deepEqual(Array.from(migratedSettings.hiddenProviders), ["deepseek"]);
assert.equal(migratedSettings.lowCnyThreshold, 12);
assert.equal(migratedSettings.lowUsdThreshold, 2);
assert.equal(Object.hasOwn(migratedSettings, "kimiRegion"), false);
assert.equal(Object.hasOwn(migratedSettings, "serpBaseCredits"), false);
assert.equal(Object.hasOwn(migratedSettings, "lowMoneyThreshold"), false);
assert.equal(Object.hasOwn(migratedSettings, "lowCreditsThreshold"), false);

const webSettings = { ...migratedSettings };
api.applyWebSettings(webSettings, {
  settings: { ...webSettings, codexAccountId: "" },
  secrets: {},
  clearSecrets: {},
});
assert.equal(webSettings.codexAccountId, "account-settings");
assert.equal(Core.formatAmount(12345.67), "12,346");
assert.equal(api.formatAge(0), "无成功记录");
assert.equal(
  Core.money(8.07, "USD", 7.2).convertedDisplay,
  "≈¥58.10"
);

const ordered = api.orderedProviders({
  providerOrder: ["codex", "deepseek", "muteki"],
  hiddenProviders: ["deepseek"],
});
assert.deepEqual(
  Array.from(ordered, (provider) => provider.id),
  ["codex", "muteki"]
);

const thresholds = {
  lowCnyThreshold: 10,
  lowUsdThreshold: 2,
  lowQuotaThreshold: 20,
};
assert.equal(
  Core.isLowBalance({ status: "ok", unit: "¥", value: 8 }, thresholds),
  true
);
assert.equal(
  Core.isLowBalance({ status: "ok", unit: "%", value: 21 }, thresholds),
  false
);
assert.equal(
  Core.isLowBalance(
    { status: "cached", unit: "$", currency: "USD", value: 2 },
    thresholds
  ),
  true
);
assert.equal(
  Core.isLowBalance({ status: "error", unit: "¥", value: 0 }, thresholds),
  false
);
assert.equal(Core.changeText(-2.5, "¥"), "↓¥2.50");
assert.equal(Core.changeText(7, "%"), "↑7%");

const settingsHTML = api.settingsPageHTML({
  ...api.CONFIG,
  codexAccountId: "account-test",
});
assert.match(settingsHTML, /设置中心/);
assert.match(settingsHTML, /API 密钥/);
assert.match(settingsHTML, /账户详情/);
assert.match(settingsHTML, /显示服务与顺序/);
assert.match(settingsHTML, /刷新品牌图标/);
assert.match(settingsHTML, /经典设置菜单/);
assert.doesNotMatch(settingsHTML, /sk-test-secret/);
assert.doesNotMatch(settingsHTML, /account-test/);
assert.match(settingsHTML, /codexAccountIdConfigured/);
assert.match(settingsHTML, /Muteki/);
assert.match(settingsHTML, /USD → CNY 参考汇率/);
assert.doesNotMatch(settingsHTML, /StepFun|Kimi|SerpBase|manual-serpbase/);

const report = api.diagnosticReport(
  { ...api.CONFIG, codexAccountId: "account-report" },
  { codex: { successfulFetchedAt: Date.now(), token: "token-report" } }
);
assert.doesNotMatch(report, /account-report|token-report|sk-test-secret/);
assert.match(report, /不包含 API Key、Access Token 或 Account ID/);

console.log("widget core: ok");
