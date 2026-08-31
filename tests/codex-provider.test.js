const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { Core, ProviderAdapters } = require("./load-production-modules");
const { codexAccountId, parseProviderFixture } = ProviderAdapters;

const fixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", `${name}.json`), "utf8"));
const now = 1_800_000_000_000;
const parse = (name) => parseProviderFixture("codex", fixture(name), { now });

const dual = parse("codex-5h-weekly");
assert.equal(dual.display, "77%");
assert.equal(dual.detail, "5小时额度");
assert.equal(dual.quota.shortWindowRemainingPercent, 77);
assert.equal(dual.quota.weeklyRemainingPercent, 59);

const weeklyOnly = parse("codex-weekly-only");
assert.equal(weeklyOnly.display, "29%");
assert.equal(weeklyOnly.detail, "周额度");
assert.equal(weeklyOnly.quota.shortWindowRemainingPercent, null);

const missing = parse("codex-missing-window-minutes");
assert.equal(missing.display, "68%");
assert.equal(missing.detail, "5小时额度");
assert.equal(missing.quota.weeklyRemainingPercent, 52);

const resetAt = parse("codex-reset-at");
assert.equal(resetAt.quota.shortWindowResetAt, 1_893_456_000_000);
assert.equal(resetAt.quota.weeklyResetAt, 1_894_060_800_000);

const resetAfter = parse("codex-reset-after-seconds");
assert.equal(resetAfter.quota.shortWindowResetAt, now + 18_000_000);
assert.equal(resetAfter.quota.weeklyResetAt, now + 604_800_000);

const exhausted = parse("codex-exhausted");
assert.equal(exhausted.display, "0%");
assert.equal(exhausted.quota.shortWindowRemainingPercent, 0);
assert.equal(exhausted.quota.weeklyRemainingPercent, 0);
assert.equal(Object.hasOwn(exhausted, "progress"), false);

const widgetSource = fs.readFileSync(path.join(__dirname, "..", "AI-Balance.js"), "utf8");
assert.match(widgetSource, /item\.quota\.shortWindowRemainingPercent/);
assert.match(widgetSource, /item\.quota\.weeklyRemainingPercent/);
assert.match(widgetSource, /item\.quota\.shortWindowResetAt/);
assert.match(widgetSource, /item\.quota\.weeklyResetAt/);
assert.doesNotMatch(widgetSource, /item\.progress|progress bar/i);

assert.equal(Core.remainingPercent({ used_percent: 120 }), 0);
assert.equal(Core.remainingPercent({}), null);
assert.equal(Core.formatResetAt(null), "");

const payload = Buffer.from(
  JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "account-auto" } })
).toString("base64url");
const token = `header.${payload}.signature`;
assert.equal(codexAccountId(token, "account-manual"), "account-manual");
assert.equal(codexAccountId(token), "account-auto");

console.log("codex provider: ok");
