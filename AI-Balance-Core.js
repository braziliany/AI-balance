/**
 * AI Balance Core
 * Cross-runtime pure functions shared by Scriptable and Node.js tests.
 */

const PROVIDER_STATUSES = Object.freeze({
  OK: "ok",
  CACHED: "cached",
  ERROR: "error",
  UNCONFIGURED: "unconfigured",
  MANUAL: "manual",
});

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatAmount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  const digits = Math.abs(number) >= 100 ? 0 : 2;
  try {
    return number.toLocaleString("zh-CN", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  } catch (_) {
    return number.toFixed(digits);
  }
}

function money(value, currency, usdToCnyRate = 0) {
  const number = finiteNumber(value);
  const code = String(currency || "CNY").toUpperCase();
  const unit = code === "USD" ? "$" : "¥";
  const rate = Number(usdToCnyRate);
  return {
    value: number,
    unit,
    currency: code,
    display: `${unit}${formatAmount(number)}`,
    convertedDisplay:
      code === "USD" && Number.isFinite(rate) && rate > 0
        ? `≈¥${formatAmount(number * rate)}`
        : "",
  };
}

function remainingPercent(window) {
  const used = Number(window?.used_percent);
  if (!Number.isFinite(used)) return null;
  return Math.max(0, Math.min(100, Math.round(100 - used)));
}

function codexWindowMinutes(window) {
  const explicit = Number(
    window?.window_minutes ??
      window?.windowMinutes ??
      window?.duration_minutes
  );
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const resetAfter = Number(window?.reset_after_seconds);
  return Number.isFinite(resetAfter) && resetAfter > 0
    ? resetAfter / 60
    : null;
}

function classifyCodexWindows(json) {
  const limits = json?.rate_limit || json?.rate_limits || json || {};
  const primary = limits.primary_window || limits.primary;
  const secondary = limits.secondary_window || limits.secondary;
  const windows = [primary, secondary].filter(Boolean);

  let shortWindow = windows.find((window) => {
    const value = codexWindowMinutes(window);
    return Number.isFinite(value) && value > 0 && value <= 360;
  });
  let weeklyWindow = windows.find((window) => {
    const value = codexWindowMinutes(window);
    return Number.isFinite(value) && value >= 1000;
  });
  const unknown = windows.filter((window) => {
    const value = codexWindowMinutes(window);
    return !Number.isFinite(value) || value <= 0;
  });

  if (!shortWindow && weeklyWindow && unknown.length) shortWindow = unknown[0];
  if (!weeklyWindow && shortWindow && unknown.length) weeklyWindow = unknown[0];
  if (!shortWindow && !weeklyWindow) {
    shortWindow = primary || windows[0] || null;
    weeklyWindow = secondary && secondary !== shortWindow ? secondary : null;
  }
  return { shortWindow, weeklyWindow };
}

function codexResetAt(window, now = Date.now()) {
  const raw = window?.reset_at ?? window?.resetAt ?? window?.reset_time;
  if (raw !== undefined && raw !== null && raw !== "") {
    const numeric = Number(raw);
    const date = Number.isFinite(numeric)
      ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
      : new Date(raw);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  const seconds = Number(window?.reset_after_seconds);
  return Number.isFinite(seconds) && seconds > 0
    ? now + seconds * 1000
    : null;
}

function formatResetAt(timestamp) {
  if (timestamp === null || timestamp === undefined || timestamp === "") {
    return "";
  }
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function emptyQuota(value = {}) {
  return {
    shortWindowRemainingPercent:
      value.shortWindowRemainingPercent ?? null,
    shortWindowResetAt: value.shortWindowResetAt ?? null,
    weeklyRemainingPercent: value.weeklyRemainingPercent ?? null,
    weeklyResetAt: value.weeklyResetAt ?? null,
  };
}

function normalizeProviderResult(provider, value = {}, context = {}) {
  const status = value.status || context.status || PROVIDER_STATUSES.OK;
  const successfulFetchedAt = finiteNumber(
    value.successfulFetchedAt ?? value.updatedAt ?? context.successfulFetchedAt,
    0
  );
  const renderedAt = finiteNumber(
    value.renderedAt ?? context.renderedAt,
    successfulFetchedAt
  );
  const cachedAtRaw = value.cachedAt ?? context.cachedAt;
  const cachedAt =
    cachedAtRaw === null || cachedAtRaw === undefined
      ? null
      : finiteNumber(cachedAtRaw, null);
  const numericValue = Number(value.value);
  const resetAtRaw = value.resetAt ?? null;
  return {
    id: String(provider.id),
    name: String(provider.name),
    shortName: String(provider.shortName || ""),
    color: String(provider.color || "yellow"),
    logoUrl: String(provider.logoUrl || ""),
    keyLabel: String(provider.keyLabel || ""),
    dashboardUrl: String(provider.dashboardUrl || ""),
    manual: Boolean(provider.manual),
    status,
    value: Number.isFinite(numericValue) ? numericValue : 0,
    unit: String(value.unit || ""),
    currency: String(value.currency || ""),
    display: String(value.display ?? "--"),
    detail: String(value.detail || ""),
    secondaryDetail: String(value.secondaryDetail || ""),
    convertedDisplay: String(value.convertedDisplay || ""),
    renderedAt,
    successfulFetchedAt,
    cachedAt,
    // Kept as a compatibility alias for v2.0 cache and UI consumers.
    updatedAt: successfulFetchedAt,
    resetAt:
      resetAtRaw === null || resetAtRaw === undefined
        ? null
        : finiteNumber(resetAtRaw, null),
    quota: emptyQuota(value.quota),
    progress: Number.isFinite(Number(value.progress))
      ? Number(value.progress)
      : null,
    delta: Number.isFinite(Number(value.delta)) ? Number(value.delta) : null,
    change: String(value.change || ""),
    periodDetail: String(value.periodDetail || ""),
    isLow: Boolean(value.isLow),
    meta:
      value.meta && typeof value.meta === "object" && !Array.isArray(value.meta)
        ? { ...value.meta }
        : {},
  };
}

function createUnconfiguredResult(provider, now = Date.now()) {
  return normalizeProviderResult(
    provider,
    {
      status: PROVIDER_STATUSES.UNCONFIGURED,
      display: "未配置",
      detail: "点击脚本配置",
    },
    { renderedAt: now }
  );
}

function safeErrorMessage(error) {
  return String(error?.message || error || "请求失败").slice(0, 24);
}

function resolveProviderFailure(provider, cached, now, cacheHours, error) {
  const cachedResult = cached
    ? normalizeProviderResult(provider, cached, { renderedAt: now })
    : null;
  const fetchedAt = Number(cachedResult?.successfulFetchedAt || 0);
  const isFresh =
    fetchedAt > 0 && now - fetchedAt < Number(cacheHours) * 3600000;
  if (isFresh) {
    return normalizeProviderResult(
      provider,
      {
        ...cachedResult,
        status: PROVIDER_STATUSES.CACHED,
        detail: "缓存数据",
        cachedAt: now,
      },
      { renderedAt: now }
    );
  }
  return normalizeProviderResult(
    provider,
    {
      status: PROVIDER_STATUSES.ERROR,
      display: "异常",
      detail: safeErrorMessage(error),
    },
    { renderedAt: now }
  );
}

function isLowBalance(item, settings) {
  if (
    ![
      PROVIDER_STATUSES.OK,
      PROVIDER_STATUSES.CACHED,
      PROVIDER_STATUSES.MANUAL,
    ].includes(item.status)
  ) {
    return false;
  }
  if (item.unit === "%") return item.value <= settings.lowQuotaThreshold;
  if (item.unit === "次") return item.value <= settings.lowCreditsThreshold;
  return item.value <= settings.lowMoneyThreshold;
}

function changeText(delta, unit) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.005) return "";
  const arrow = delta > 0 ? "↑" : "↓";
  const amount = Math.abs(delta);
  const value =
    unit === "%" || unit === "次"
      ? Math.round(amount)
      : amount.toFixed(amount >= 10 ? 0 : 2);
  if (unit === "%") return `${arrow}${value}%`;
  if (unit === "次") return `${arrow}${value}`;
  return `${arrow}${unit}${value}`;
}

function historicalValue(entries, targetAt, maxLag = Infinity) {
  const candidates = (entries || [])
    .filter(
      (entry) =>
        Number.isFinite(Number(entry.at)) &&
        Number.isFinite(Number(entry.value)) &&
        Number(entry.at) <= targetAt
    )
    .sort((left, right) => Number(right.at) - Number(left.at));
  if (!candidates.length) return null;
  const candidate = candidates[0];
  return targetAt - Number(candidate.at) <= maxLag
    ? Number(candidate.value)
    : null;
}

function applyHistory(results, history, now) {
  const dayMs = 24 * 60 * 60 * 1000;
  const cutoff = now - 8 * dayMs;
  for (const id of Object.keys(history)) {
    history[id] = (Array.isArray(history[id]) ? history[id] : []).filter(
      (entry) => Number(entry.at) >= cutoff
    );
  }

  for (const item of results) {
    if (
      ![PROVIDER_STATUSES.OK, PROVIDER_STATUSES.MANUAL].includes(item.status)
    ) {
      continue;
    }
    const entries = Array.isArray(history[item.id]) ? history[item.id] : [];
    const dailyValue = historicalValue(entries, now - dayMs, dayMs / 2);
    const weeklyValue = historicalValue(entries, now - 7 * dayMs, dayMs);
    const daily =
      dailyValue === null ? "" : changeText(item.value - dailyValue, item.unit);
    const weekly =
      weeklyValue === null
        ? ""
        : changeText(item.value - weeklyValue, item.unit);
    item.periodDetail = [
      daily ? `日 ${daily}` : "",
      weekly ? `周 ${weekly}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const recent = entries[entries.length - 1];
    const shouldAppend = !recent || now - Number(recent.at) >= 15 * 60 * 1000;
    const retained = [...entries];
    if (shouldAppend) {
      retained.push({ at: now, value: item.value, unit: item.unit });
    }
    history[item.id] = retained;
  }
  return history;
}

function decodeJwtPayload(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return {};
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    if (typeof Data === "undefined") return {};
    const text = Data.fromBase64String(padded).toRawString();
    return JSON.parse(text);
  } catch (_) {
    return {};
  }
}

module.exports = {
  PROVIDER_STATUSES,
  applyHistory,
  changeText,
  classifyCodexWindows,
  codexResetAt,
  codexWindowMinutes,
  createUnconfiguredResult,
  decodeJwtPayload,
  formatAmount,
  formatResetAt,
  historicalValue,
  isLowBalance,
  money,
  normalizeProviderResult,
  remainingPercent,
  resolveProviderFailure,
};
