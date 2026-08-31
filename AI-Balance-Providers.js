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
        meta: { source: "deepseek" },
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
      return {
        value: mainRemaining,
        unit: "%",
        display: `${mainRemaining}%`,
        detail: shortRemaining !== null ? "5小时额度" : "周额度",
        secondaryDetail:
          weeklyRemaining === null ? "" : `周额度 ${weeklyRemaining}%`,
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
    id: "muteki",
    name: "Muteki",
    shortName: "MT",
    color: "orange",
    logoUrl: "",
    keyLabel: "Muteki API Key",
    dashboardUrl: "https://api.muteki.site",
    async fetch(context) {
      return context.requestJSON(
        "https://api.muteki.site/v1/usage",
        context.credential
      );
    },
    parse(json, context) {
      if (json?.isValid === false) throw new Error("Muteki API Key 无效");
      const remaining =
        json?.remaining === null || json?.remaining === undefined
          ? null
          : Number(json.remaining);
      const balance =
        json?.balance === null || json?.balance === undefined
          ? null
          : Number(json.balance);
      const hasRemaining = Number.isFinite(remaining);
      const hasBalance = Number.isFinite(balance);
      if (!hasRemaining && !hasBalance) throw new Error("余额响应缺少有效数值");
      if (hasRemaining && hasBalance) {
        const tolerance = Math.max(0.01, Math.abs(balance) * 0.01);
        if (Math.abs(remaining - balance) > tolerance) {
          throw new Error("余额响应异常");
        }
      }
      const wallet = hasRemaining ? remaining : balance;
      if (wallet < 0) throw new Error("余额响应异常");
      const currency = String(json?.unit || "USD").toUpperCase();
      if (currency !== "USD") throw new Error("Muteki 币种响应异常");
      const todayRaw = json?.usage?.today?.actual_cost;
      const todayActualCost =
        todayRaw === null || todayRaw === undefined
          ? null
          : Number(todayRaw);
      const hasTodayCost =
        Number.isFinite(todayActualCost) && todayActualCost >= 0;
      const totalRaw = json?.usage?.total?.actual_cost;
      const totalActualCost =
        totalRaw === null || totalRaw === undefined ? null : Number(totalRaw);
      const requestsToday = Number(json?.usage?.today?.requests);
      const totalTokensToday = Number(json?.usage?.today?.total_tokens);
      const result = money(
        wallet,
        "USD",
        context.settings.usdToCnyRate
      );
      return {
        ...result,
        detail: String(json?.planName || "钱包余额"),
        secondaryDetail: hasTodayCost
          ? `今日 ${money(todayActualCost, "USD").display}`
          : "",
        meta: {
          source: "muteki",
          planName: String(json?.planName || ""),
          mode: String(json?.mode || ""),
          todayActualCost: hasTodayCost ? todayActualCost : null,
          totalActualCost: Number.isFinite(totalActualCost)
            ? totalActualCost
            : null,
          requestsToday: Number.isFinite(requestsToday) ? requestsToday : null,
          totalTokensToday: Number.isFinite(totalTokensToday)
            ? totalTokensToday
            : null,
        },
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
    codexAccountId: "",
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
