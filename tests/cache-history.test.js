const assert = require("node:assert/strict");
const { Core, ProviderAdapters } = require("./load-production-modules");
const { PROVIDERS } = ProviderAdapters;

const deepseek = PROVIDERS.find((provider) => provider.id === "deepseek");
const now = 100_000_000;
const settings = {
  lowCnyThreshold: 10,
  lowUsdThreshold: 2,
  lowQuotaThreshold: 20,
};
const success = Core.normalizeProviderResult(
  deepseek,
  { value: 22.82, unit: "¥", display: "¥22.82", detail: "充值 ¥20.00" },
  { status: "ok", renderedAt: now, successfulFetchedAt: now }
);
assert.equal(success.status, "ok");
assert.equal(success.successfulFetchedAt, now);
assert.equal(success.cachedAt, null);

const legacyCache = {
  id: "deepseek",
  value: 22.82,
  unit: "¥",
  display: "¥22.82",
  detail: "充值 ¥20.00",
  updatedAt: now,
};
const cached = Core.resolveProviderFailure(
  deepseek, legacyCache, now + 1000, 24, new Error("HTTP 429")
);
assert.equal(cached.status, "cached");
assert.equal(cached.successfulFetchedAt, now);
assert.equal(cached.updatedAt, now);
assert.equal(cached.cachedAt, now + 1000);
assert.equal(cached.renderedAt, now + 1000);
assert.equal(cached.detail, "缓存数据");

const expired = Core.resolveProviderFailure(
  deepseek, legacyCache, now + 25 * 3_600_000, 24, new Error("密钥失效")
);
assert.equal(expired.status, "error");
assert.equal(expired.display, "异常");

const unconfigured = Core.createUnconfiguredResult(deepseek, now);
assert.equal(unconfigured.status, "unconfigured");
assert.equal(unconfigured.display, "未配置");
assert.equal(Core.isLowBalance(unconfigured, settings), false);

const history = {
  deepseek: [
    { at: now - 7 * 86_400_000 - 1000, value: 30, unit: "¥" },
    { at: now - 86_400_000 - 1000, value: 25, unit: "¥" },
  ],
};
const result = Core.normalizeProviderResult(
  deepseek,
  { value: 22.82, unit: "¥", display: "¥22.82" },
  { status: "ok", renderedAt: now, successfulFetchedAt: now }
);
Core.applyHistory([result], history, now);
assert.equal(result.periodDetail, "日 ↓¥2.18 · 周 ↓¥7.18");
assert.deepEqual(history.deepseek.at(-1), { at: now, value: 22.82, unit: "¥" });
assert.equal(Object.hasOwn(history.deepseek.at(-1), "successfulFetchedAt"), false);

const muteki = PROVIDERS.find((provider) => provider.id === "muteki");
const mutekiResult = Core.normalizeProviderResult(
  muteki,
  { value: 6.23, unit: "$", currency: "USD", display: "$6.23" },
  { status: "ok", renderedAt: now, successfulFetchedAt: now }
);
const mutekiHistory = {};
Core.applyHistory([mutekiResult], mutekiHistory, now);
assert.deepEqual(mutekiHistory.muteki, [{ at: now, value: 6.23, unit: "$" }]);
assert.equal(Core.isLowBalance(mutekiResult, settings), false);

console.log("cache and history: ok");
