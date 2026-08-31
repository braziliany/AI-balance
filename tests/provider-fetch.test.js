const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { ProviderAdapters } = require("./load-production-modules");
const { PROVIDERS, fetchProvider } = ProviderAdapters;
const fixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", `${name}.json`), "utf8"));
const responses = {
  deepseek: fixture("deepseek-balance"),
  codex: fixture("codex-5h-weekly"),
  muteki: fixture("muteki-wallet"),
};
const expectedUrl = {
  deepseek: "https://api.deepseek.com/user/balance",
  codex: "https://chatgpt.com/backend-api/wham/usage",
  muteki: "https://api.muteki.site/v1/usage",
};

(async () => {
  for (const provider of PROVIDERS) {
    const calls = [];
    const context = {
      credential: "credential-test-only",
      now: 1_800_000_000_000,
      settings: {
        usdToCnyRate: 0,
        codexAccountId: "account-test-only",
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
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, expectedUrl[provider.id]);
    assert.equal(calls[0].credential, "credential-test-only");
    if (provider.id === "codex") {
      assert.equal(calls[0].headers["ChatGPT-Account-Id"], "account-test-only");
    }
  }
  console.log("provider fetch: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
