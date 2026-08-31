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
  settingsVersion: 7,
  themeMode: "light",
  providerOrder: ["kimi", "deepseek"],
  hiddenProviders: ["stepfun"],
  cacheHours: 48,
  codexAccountId: "account-settings",
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
assert.deepEqual(
  Array.from(migratedSettings.providerOrder),
  ["kimi", "deepseek", "stepfun", "codex", "serpbase"]
);
assert.deepEqual(Array.from(migratedSettings.hiddenProviders), ["stepfun"]);

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
  Core.isLowBalance({ status: "ok", unit: "¥", value: 8 }, thresholds),
  true
);
assert.equal(
  Core.isLowBalance({ status: "ok", unit: "%", value: 21 }, thresholds),
  false
);
assert.equal(
  Core.isLowBalance({ status: "cached", unit: "次", value: 100 }, thresholds),
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

const report = api.diagnosticReport(
  { ...api.CONFIG, codexAccountId: "account-report" },
  { codex: { successfulFetchedAt: Date.now(), token: "token-report" } }
);
assert.doesNotMatch(report, /account-report|token-report|sk-test-secret/);
assert.match(report, /不包含 API Key、Access Token 或 Account ID/);

console.log("widget core: ok");
