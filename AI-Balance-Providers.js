/**
 * AI Balance Provider Adapters
 * Provider-specific fetch, parse, compatibility, and normalization logic.
 */

const Core = importModule("AI-Balance-Core");

const {
  PROVIDER_STATUSES,
  classifyCodexWindows,
  codexResetAt,
  decodeJwtPayload,
  formatResetAt,
  money,
  normalizeProviderResult,
  remainingPercent,
} = Core;

const PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    shortName: "DS",
    color: "yellow",
    logoUrl:
      "https://raw.githubusercontent.com/braziliany/AI-balance/main/assets/logos/deepseek.png",
    keyLabel: "DeepSeek API Key",
    dashboardUrl: "https://platform.deepseek.com/usage",
    async fetch(context) {
      return context.requestJSON(
        "https://api.deepseek.com/user/balance",
        context.credential
      );
    },
    parse(json, context) {
      const balances = json.balance_infos || [];
      const item =
        balances.find((value) => value.currency === "CNY") || balances[0];
      if (!item) throw new Error("响应中没有余额");
      return {
        ...money(item.total_balance, item.currency, context.settings.usdToCnyRate),
        detail: `充值 ${
          money(item.topped_up_balance, item.currency, context.settings.usdToCnyRate)
            .display
        }`,
        secondaryDetail: `赠送 ${
          money(item.granted_balance, item.currency, context.settings.usdToCnyRate)
            .display
        }`,
        meta: { source: "deepseek" },
      };
    },
  },
  {
    id: "stepfun",
    name: "StepFun",
    shortName: "SF",
    color: "orange",
    logoUrl:
      "https://raw.githubusercontent.com/braziliany/AI-balance/main/assets/logos/stepfun.png",
    keyLabel: "StepFun API Key",
    dashboardUrl: "https://platform.stepfun.com/",
    async fetch(context) {
      return context.requestJSON(
        "https://api.stepfun.com/v1/accounts",
        context.credential
      );
    },
    parse(json) {
      const account = json.data || json;
      const result = money(account.balance, account.currency || "CNY");
      return {
        ...result,
        detail: `充值 ${money(account.total_cash_balance, "CNY").display}`,
        secondaryDetail: `赠送 ${
          money(account.total_voucher_balance, "CNY").display
        }`,
        meta: { source: "stepfun", accountType: String(account.type || "") },
      };
    },
  },
  {
    id: "codex",
    name: "Codex",
    shortName: "CX",
    color: "red",
    logoUrl:
      "https://raw.githubusercontent.com/braziliany/AI-balance/main/assets/logos/codex.png",
    keyLabel: "Codex Access Token",
    dashboardUrl: "https://chatgpt.com/codex/settings/usage",
    async fetch(context) {
      const accountId = codexAccountId(
        context.credential,
        context.settings.codexAccountId
      );
      const headers = accountId ? { "ChatGPT-Account-Id": accountId } : {};
      return context.requestJSON(
        "https://chatgpt.com/backend-api/wham/usage",
        context.credential,
        headers
      );
    },
    parse(json, context) {
      const { shortWindow, weeklyWindow } = classifyCodexWindows(json);
      const shortRemaining = remainingPercent(shortWindow);
      const weeklyRemaining = remainingPercent(weeklyWindow);
      const mainRemaining =
        shortRemaining !== null ? shortRemaining : weeklyRemaining;
      if (mainRemaining === null) {
        throw new Error("Codex 额度响应格式已变化");
      }
      const shortResetAt = codexResetAt(shortWindow, context.now);
      const weeklyResetAt = codexResetAt(weeklyWindow, context.now);
      const resetAt = weeklyResetAt || shortResetAt;
      const resetText = formatResetAt(resetAt);
      return {
        value: mainRemaining,
        unit: "%",
        display: `${mainRemaining}%`,
        detail: shortRemaining !== null ? "5小时剩余" : "周剩余",
        secondaryDetail:
          mainRemaining === 0 && resetText
            ? `下次重置 ${resetText}`
            : weeklyRemaining === null
              ? ""
              : `周剩余 ${weeklyRemaining}%`,
        progress: mainRemaining / 100,
        resetAt,
        quota: {
          shortWindowRemainingPercent: shortRemaining,
          shortWindowResetAt: shortResetAt,
          weeklyRemainingPercent: weeklyRemaining,
          weeklyResetAt,
        },
        meta: { source: "codex", experimental: true },
      };
    },
  },
  {
    id: "serpbase",
    name: "SerpBase MCP",
    shortName: "SB",
    color: "yellow",
    logoUrl:
      "https://raw.githubusercontent.com/braziliany/AI-balance/main/assets/logos/serpbase.jpg",
    manual: true,
    dashboardUrl: "https://serpbase.dev/dashboard",
    async fetch(context) {
      return { credits: Number(context.settings.serpBaseCredits || 0) };
    },
    parse(value) {
      const credits = Number(value.credits || 0);
      return {
        status: PROVIDER_STATUSES.MANUAL,
        value: credits,
        unit: "次",
        display: `${Math.max(0, credits).toLocaleString()}`,
        detail: "手动额度",
        meta: { source: "manual" },
      };
    },
  },
  {
    id: "kimi",
    name: "Kimi",
    shortName: "KM",
    color: "orange",
    logoUrl:
      "https://raw.githubusercontent.com/braziliany/AI-balance/main/assets/logos/kimi.png",
    keyLabel: "Kimi API Key",
    dashboardUrl: "https://platform.moonshot.cn/console/account",
    async fetch(context) {
      const host =
        context.settings.kimiRegion === "international"
          ? "https://api.moonshot.ai"
          : "https://api.moonshot.cn";
      return context.requestJSON(
        `${host}/v1/users/me/balance`,
        context.credential
      );
    },
    parse(json, context) {
      if (json.status === false) throw new Error(json.message || "查询失败");
      const data = json.data || {};
      const currency =
        context.settings.kimiRegion === "international" ? "USD" : "CNY";
      return {
        ...money(data.available_balance, currency, context.settings.usdToCnyRate),
        detail: `现金 ${
          money(data.cash_balance, currency, context.settings.usdToCnyRate).display
        }`,
        secondaryDetail: `代金券 ${
          money(data.voucher_balance, currency, context.settings.usdToCnyRate)
            .display
        }`,
        meta: { source: "kimi", region: context.settings.kimiRegion },
      };
    },
  },
];

function codexAccountId(token, configuredAccountId = "") {
  if (configuredAccountId) return configuredAccountId;
  const payload = decodeJwtPayload(token);
  const auth = payload["https://api.openai.com/auth"] || {};
  return (
    auth.chatgpt_account_id ||
    payload.chatgpt_account_id ||
    payload.account_id ||
    ""
  );
}

async function fetchProvider(provider, context) {
  const raw = await provider.fetch(context);
  const parsed = provider.parse(raw, context);
  return normalizeProviderResult(
    provider,
    parsed,
    {
      status: parsed.status || PROVIDER_STATUSES.OK,
      renderedAt: context.now,
      successfulFetchedAt: context.now,
    }
  );
}

function parseProviderFixture(providerId, response, context = {}) {
  const provider = PROVIDERS.find((item) => item.id === providerId);
  if (!provider) throw new Error(`未知 Provider：${providerId}`);
  const now = Number(context.now || Date.now());
  const settings = {
    usdToCnyRate: 0,
    kimiRegion: "cn",
    codexAccountId: "",
    serpBaseCredits: 0,
    ...(context.settings || {}),
  };
  const parsed = provider.parse(response, { ...context, now, settings });
  return normalizeProviderResult(provider, parsed, {
    status: parsed.status || PROVIDER_STATUSES.OK,
    renderedAt: now,
    successfulFetchedAt: now,
  });
}

module.exports = {
  PROVIDERS,
  codexAccountId,
  fetchProvider,
  parseProviderFixture,
};
