const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { ProviderAdapters } = require("./load-production-modules");
const { PROVIDERS, fetchProvider } = ProviderAdapters;
const fixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", `${name}.json`), "utf8"));
const responses = {
  deepseek: fixture("deepseek-balance"),
  stepfun: fixture("stepfun-account"),
  codex: fixture("codex-5h-weekly"),
  kimi: fixture("kimi-balance"),
};
const expectedUrl = {
  deepseek: "https://api.deepseek.com/user/balance",
  stepfun: "https://api.stepfun.com/v1/accounts",
  codex: "https://chatgpt.com/backend-api/wham/usage",
  kimi: "https://api.moonshot.cn/v1/users/me/balance",
};

(async () => {
  for (const provider of PROVIDERS) {
    const calls = [];
    const context = {
      credential: "credential-test-only",
      now: 1_800_000_000_000,
      settings: {
        usdToCnyRate: 0,
        kimiRegion: "cn",
        codexAccountId: "account-test-only",
        serpBaseCredits: 123,
      },
      requestJSON: async (url, credential, headers = {}) => {
        calls.push({ url, credential, headers });
        return responses[provider.id];
      },
    };
    const result = await fetchProvider(provider, context);
    assert.equal(result.id, provider.id);
    assert.doesNotMatch(
      JSON.stringify(result),
      /credential-test-only|account-test-only/
    );
    if (provider.manual) {
      assert.equal(calls.length, 0);
      assert.equal(result.status, "manual");
    } else {
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, expectedUrl[provider.id]);
      assert.equal(calls[0].credential, "credential-test-only");
      if (provider.id === "codex") {
        assert.equal(calls[0].headers["ChatGPT-Account-Id"], "account-test-only");
      }
    }
  }
  console.log("provider fetch: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
