// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: wallet;

/**
 * AI Balance Widget
 * DeepSeek / StepFun / Codex / SerpBase / Kimi 余额概览
 *
 * 依赖：LPL-Design-System.js（与本脚本放在 Scriptable 同一目录）
 * 首次在 Scriptable App 内运行会打开配置菜单，密钥保存于 iOS Keychain。
 */

const APP = {
  name: "AI Balance",
  version: "1.5.0",
  settingsVersion: 5,
  keychainPrefix: "ai-balance.",
  cacheFile: "ai-balance-cache.json",
};

let DesignSystem;
try {
  DesignSystem = importModule("LPL-Design-System");
} catch (error) {
  throw new Error(
    "缺少 LPL-Design-System。请先把 LPL-Design-System.js 放入 Scriptable 目录。"
  );
}

const CONFIG = {
  title: "AI BALANCE",
  themeMode: "dark",
  refreshMinutes: 30,
  cacheHours: 24,
  codexAccountId: "",
  serpBaseCredits: 0,
  kimiRegion: "cn",
  hiddenProviders: [],
  providerOrder: ["deepseek", "stepfun", "codex", "serpbase", "kimi"],
  lowMoneyThreshold: 10,
  lowQuotaThreshold: 20,
  lowCreditsThreshold: 100,
};

const PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    shortName: "DS",
    color: "yellow",
    keyLabel: "DeepSeek API Key",
    dashboardUrl: "https://platform.deepseek.com/usage",
    fetch: fetchDeepSeek,
  },
  {
    id: "stepfun",
    name: "StepFun",
    shortName: "SF",
    color: "orange",
    keyLabel: "StepFun API Key",
    dashboardUrl: "https://platform.stepfun.com/",
    fetch: fetchStepFun,
  },
  {
    id: "codex",
    name: "Codex",
    shortName: "CX",
    color: "red",
    keyLabel: "Codex Access Token",
    dashboardUrl: "https://chatgpt.com/codex/settings/usage",
    fetch: fetchCodex,
  },
  {
    id: "serpbase",
    name: "SerpBase MCP",
    shortName: "SB",
    color: "yellow",
    manual: true,
    dashboardUrl: "https://serpbase.dev/dashboard",
    fetch: fetchSerpBase,
  },
  {
    id: "kimi",
    name: "Kimi",
    shortName: "KM",
    color: "orange",
    keyLabel: "Kimi API Key",
    dashboardUrl: "https://platform.moonshot.cn/console/account",
    fetch: fetchKimi,
  },
];

function keychainKey(id) {
  return `${APP.keychainPrefix}${id}`;
}

function getSecret(id) {
  const key = keychainKey(id);
  return Keychain.contains(key) ? Keychain.get(key) : "";
}

function setSecret(id, value) {
  const key = keychainKey(id);
  if (value) Keychain.set(key, value.trim());
  else if (Keychain.contains(key)) Keychain.remove(key);
}

function settingsPath() {
  return FileManager.local().joinPath(
    FileManager.local().documentsDirectory(),
    "ai-balance-settings.json"
  );
}

function loadSettings() {
  const path = settingsPath();
  if (!FileManager.local().fileExists(path)) {
    return { ...CONFIG, settingsVersion: APP.settingsVersion };
  }
  try {
    const stored = JSON.parse(FileManager.local().readString(path));
    // v1 的主题菜单是“每点击一次循环切换”，容易误切到浅色。
    // 第一次升级到 v2 时恢复与 LPL Schedule 相同的深蓝主题。
    if (!stored.settingsVersion) stored.themeMode = "dark";
    const providerIds = PROVIDERS.map((provider) => provider.id);
    const storedOrder = Array.isArray(stored.providerOrder)
      ? stored.providerOrder.filter((id) => providerIds.includes(id))
      : [];
    const providerOrder = [
      ...storedOrder,
      ...providerIds.filter((id) => !storedOrder.includes(id)),
    ];
    const hiddenProviders = Array.isArray(stored.hiddenProviders)
      ? stored.hiddenProviders.filter((id) => providerIds.includes(id))
      : [];
    return {
      ...CONFIG,
      ...stored,
      providerOrder,
      hiddenProviders,
      settingsVersion: APP.settingsVersion,
    };
  } catch (_) {
    return { ...CONFIG, settingsVersion: APP.settingsVersion };
  }
}

function saveSettings(settings) {
  FileManager.local().writeString(
    settingsPath(),
    JSON.stringify(settings, null, 2)
  );
}

function cachePath() {
  return FileManager.local().joinPath(
    FileManager.local().documentsDirectory(),
    APP.cacheFile
  );
}

function readCache() {
  const path = cachePath();
  if (!FileManager.local().fileExists(path)) return {};
  try {
    return JSON.parse(FileManager.local().readString(path));
  } catch (_) {
    return {};
  }
}

function writeCache(data) {
  FileManager.local().writeString(cachePath(), JSON.stringify(data));
}

async function requestJSON(url, key, headers = {}) {
  const request = new Request(url);
  request.method = "GET";
  request.timeoutInterval = 15;
  request.headers = {
    Accept: "application/json",
    Authorization: `Bearer ${key}`,
    ...headers,
  };
  const json = await request.loadJSON();
  const status = request.response ? request.response.statusCode : 200;
  if (status < 200 || status >= 300) {
    const detail = json.error?.message || json.error || json.message || status;
    throw new Error(String(detail));
  }
  return json;
}

function money(value, currency) {
  const number = Number(value);
  return {
    value: Number.isFinite(number) ? number : 0,
    unit: String(currency || "CNY").toUpperCase() === "USD" ? "$" : "¥",
    display: `${String(currency || "CNY").toUpperCase() === "USD" ? "$" : "¥"}${
      Number.isFinite(number) ? number.toFixed(number >= 100 ? 0 : 2) : "--"
    }`,
  };
}

async function fetchDeepSeek(key) {
  const json = await requestJSON("https://api.deepseek.com/user/balance", key);
  return parseDeepSeekBalance(json);
}

function parseDeepSeekBalance(json) {
  const balances = json.balance_infos || [];
  const item =
    balances.find((value) => value.currency === "CNY") || balances[0];
  if (!item) throw new Error("响应中没有余额");
  return {
    ...money(item.total_balance, item.currency),
    detail: `充值 ${money(item.topped_up_balance, item.currency).display}`,
    secondaryDetail:
      `赠送 ${money(item.granted_balance, item.currency).display}`,
  };
}

async function fetchStepFun(key) {
  const json = await requestJSON("https://api.stepfun.com/v1/accounts", key);
  return parseStepFunBalance(json);
}

function parseStepFunBalance(json) {
  const account = json.data || json;
  const result = money(account.balance, account.currency || "CNY");
  return {
    ...result,
    detail: `充值 ${money(account.total_cash_balance, "CNY").display}`,
    secondaryDetail:
      `赠送 ${money(account.total_voucher_balance, "CNY").display}`,
  };
}

async function fetchKimi(key, settings) {
  const host =
    settings.kimiRegion === "international"
      ? "https://api.moonshot.ai"
      : "https://api.moonshot.cn";
  const json = await requestJSON(
    `${host}/v1/users/me/balance`,
    key
  );
  return parseKimiBalance(
    json,
    settings.kimiRegion === "international" ? "USD" : "CNY"
  );
}

function parseKimiBalance(json, currency) {
  if (json.status === false) throw new Error(json.message || "查询失败");
  const data = json.data || {};
  return {
    ...money(data.available_balance, currency),
    detail: `现金 ${money(data.cash_balance, currency).display}`,
    secondaryDetail:
      `代金券 ${money(data.voucher_balance, currency).display}`,
  };
}

function decodeJwtPayload(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return {};
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(Data.fromBase64String(padded).toRawString());
  } catch (_) {
    return {};
  }
}

function codexAccountId(token, settings) {
  if (settings.codexAccountId) return settings.codexAccountId;
  const payload = decodeJwtPayload(token);
  const auth = payload["https://api.openai.com/auth"] || {};
  return (
    auth.chatgpt_account_id ||
    payload.chatgpt_account_id ||
    payload.account_id ||
    ""
  );
}

function remainingPercent(window) {
  const used = Number(window?.used_percent);
  if (!Number.isFinite(used)) return null;
  return Math.max(0, Math.min(100, Math.round(100 - used)));
}

async function fetchCodex(key, settings) {
  const accountId = codexAccountId(key, settings);
  const headers = accountId ? { "ChatGPT-Account-Id": accountId } : {};
  const json = await requestJSON(
    "https://chatgpt.com/backend-api/wham/usage",
    key,
    headers
  );
  return parseCodexQuota(json);
}

function parseCodexQuota(json) {
  const limits = json.rate_limit || json.rate_limits || json;
  const primary = limits.primary_window || limits.primary;
  const secondary = limits.secondary_window || limits.secondary;
  const fiveHourRemaining = remainingPercent(primary);
  const weeklyRemaining = remainingPercent(secondary);
  if (fiveHourRemaining === null) {
    throw new Error("Codex 额度响应格式已变化");
  }
  return {
    value: fiveHourRemaining,
    unit: "%",
    display: `${fiveHourRemaining}%`,
    detail:
      weeklyRemaining === null
        ? "5小时剩余"
        : `5小时 · 周剩余 ${weeklyRemaining}%`,
    secondaryDetail: "Codex 订阅额度",
    progress: fiveHourRemaining / 100,
  };
}

async function fetchSerpBase(_, settings) {
  const credits = Number(settings.serpBaseCredits || 0);
  return {
    value: credits,
    unit: "次",
    display: `${Math.max(0, credits).toLocaleString()}`,
    detail: "手动额度",
    manual: true,
  };
}

function orderedProviders(settings) {
  const byId = Object.fromEntries(
    PROVIDERS.map((provider) => [provider.id, provider])
  );
  return settings.providerOrder
    .filter((id) => !settings.hiddenProviders.includes(id))
    .map((id) => byId[id])
    .filter(Boolean);
}

function isLowBalance(item, settings) {
  if (item.status !== "ok" && item.status !== "cached") return false;
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

async function loadBalances(settings) {
  const cache = readCache();
  const now = Date.now();
  const results = await Promise.all(
    orderedProviders(settings).map(async (provider) => {
      const key = provider.manual ? "" : getSecret(provider.id);
      if (!provider.manual && !key) {
        return { ...provider, status: "unset", display: "未配置", detail: "点击脚本配置" };
      }
      try {
        const balance = await provider.fetch(key, settings);
        const item = { ...provider, ...balance, status: "ok", updatedAt: now };
        const oldValue = Number(cache[provider.id]?.value);
        if (Number.isFinite(oldValue)) {
          item.delta = item.value - oldValue;
          item.change = changeText(item.delta, item.unit);
        }
        item.isLow = isLowBalance(item, settings);
        cache[provider.id] = item;
        return item;
      } catch (error) {
        const old = cache[provider.id];
        const freshEnough =
          old && now - Number(old.updatedAt || 0) < settings.cacheHours * 3600000;
        if (freshEnough) {
          const item = { ...old, ...provider, status: "cached", detail: "缓存数据" };
          item.isLow = isLowBalance(item, settings);
          return item;
        }
        return {
          ...provider,
          status: "error",
          display: "异常",
          detail: String(error.message || error).slice(0, 24),
        };
      }
    })
  );
  writeCache(cache);
  return results;
}

function addText(stack, text, size, color, weight = "regular") {
  const label = stack.addText(String(text));
  label.font =
    weight === "bold" ? Font.boldSystemFont(size) : Font.systemFont(size);
  label.textColor = new Color(color);
  label.lineLimit = 1;
  label.minimumScaleFactor = 0.65;
  return label;
}

function addHeader(widget, palette, settings) {
  const header = widget.addStack();
  header.centerAlignContent();
  const mark = header.addStack();
  mark.size = new Size(16, 16);
  mark.backgroundColor = new Color(palette.yellow);
  mark.cornerRadius = 4;
  header.addSpacer(10);
  addText(header, settings.title, 16, palette.white, "bold");
  header.addSpacer();
  addText(header, "●", 9, palette.orange);
}

function addProviderRow(parent, item, palette, compact = false) {
  const row = parent.addStack();
  row.url = item.dashboardUrl;
  row.centerAlignContent();
  const badge = row.addStack();
  badge.size = new Size(compact ? 26 : 30, compact ? 20 : 22);
  badge.cornerRadius = 6;
  badge.backgroundColor = new Color(palette[item.color], 0.18);
  const initials = addText(
    badge,
    item.shortName,
    compact ? 9 : 10,
    palette[item.color],
    "bold"
  );
  initials.centerAlignText();
  row.addSpacer(compact ? 7 : 9);
  const info = row.addStack();
  info.layoutVertically();
  addText(info, item.name, compact ? 12 : 14, palette.white, "bold");
  if (!compact) addText(info, item.detail, 10, palette.secondary);
  row.addSpacer();
  const color = item.isLow
    ? palette.red
    :
    item.status === "error" || item.status === "unset"
      ? palette.muted
      : palette.white;
  addText(row, item.display, compact ? 14 : 17, color, "bold");
}

function addBalanceCard(parent, item, palette) {
  const card = parent.addStack();
  card.url = item.dashboardUrl;
  card.layoutVertically();
  card.setPadding(11, 12, 10, 12);
  card.cornerRadius = 12;
  card.backgroundColor = new Color(palette.divider, 0.07);

  const top = card.addStack();
  top.centerAlignContent();
  addText(top, item.shortName, 10, palette[item.color], "bold");
  top.addSpacer(7);
  addText(top, item.name, 13, palette.secondary, "bold");
  card.addSpacer(7);

  const valueColor = item.isLow
    ? palette.red
    :
    item.status === "error" || item.status === "unset"
      ? palette.muted
      : palette.white;
  addText(card, item.display, 24, valueColor, "bold");
  card.addSpacer(3);
  addText(
    card,
    [item.detail, item.change].filter(Boolean).join(" · "),
    10,
    palette.secondary
  );
  if (item.secondaryDetail) {
    card.addSpacer(2);
    addText(card, item.secondaryDetail, 9, palette.muted);
  }
  if (Number.isFinite(item.progress)) {
    card.addSpacer(7);
    const track = card.addStack();
    track.size = new Size(100, 4);
    track.cornerRadius = 2;
    track.backgroundColor = new Color(palette.divider, 0.1);
    const fill = track.addStack();
    fill.size = new Size(Math.max(2, Math.round(item.progress * 100)), 4);
    fill.cornerRadius = 2;
    fill.backgroundColor = new Color(item.isLow ? palette.red : palette.yellow);
  }
  return card;
}

function createWidget(items, settings) {
  const widget = new ListWidget();
  const palette = DesignSystem.resolvePalette(settings.themeMode);
  DesignSystem.applyCardBackground(widget, palette);
  widget.setPadding(15, 15, 13, 15);
  addHeader(widget, palette, settings);
  widget.addSpacer(12);

  const family = config.widgetFamily || "medium";
  if (family === "small") {
    const configured = items.filter((item) => item.status !== "unset");
    for (const item of configured.slice(0, 3)) {
      addProviderRow(widget, item, palette, true);
      widget.addSpacer(7);
    }
    if (!configured.length) {
      addText(widget, "请在 App 内运行脚本完成配置", 12, palette.secondary);
    }
  } else if (family === "large") {
    const highlights = widget.addStack();
    if (items[0]) addBalanceCard(highlights, items[0], palette);
    if (items[1]) {
      highlights.addSpacer(10);
      addBalanceCard(highlights, items[1], palette);
    }
    if (items.length) widget.addSpacer(13);

    for (const item of items.slice(2)) {
      addProviderRow(widget, item, palette, false);
      widget.addSpacer(12);
    }
  } else {
    const columns = widget.addStack();
    const left = columns.addStack();
    left.layoutVertically();
    columns.addSpacer(14);
    const right = columns.addStack();
    right.layoutVertically();
    items.forEach((item, index) => {
      const column = index < 3 ? left : right;
      addProviderRow(column, item, palette, true);
      column.addSpacer(9);
    });
  }

  widget.addSpacer();
  const lastSuccess = items.reduce(
    (latest, item) => Math.max(latest, Number(item.updatedAt || 0)),
    0
  );
  const updated = lastSuccess ? new Date(lastSuccess) : new Date();
  const footer = widget.addStack();
  addText(
    footer,
    `${lastSuccess ? "成功 " : ""}${updated.getMonth() + 1}/${updated.getDate()} ${String(
      updated.getHours()
    ).padStart(2, "0")}:${String(updated.getMinutes()).padStart(2, "0")}`,
    9,
    palette.muted
  );
  footer.addSpacer();
  addText(footer, `v${APP.version}`, 9, palette.muted);
  widget.refreshAfterDate = new Date(
    Date.now() + settings.refreshMinutes * 60000
  );
  return widget;
}

async function promptText(title, message, value = "", secure = false) {
  const alert = new Alert();
  alert.title = title;
  alert.message = message;
  if (secure) alert.addSecureTextField("", String(value));
  else alert.addTextField("", String(value));
  alert.addAction("保存");
  alert.addCancelAction("取消");
  const index = await alert.presentAlert();
  return index === -1 ? null : alert.textFieldValue(0).trim();
}

async function chooseThemeMode(current) {
  const modes = [
    ["dark", "深蓝主题（与 LPL 一致）"],
    ["light", "浅色主题"],
    ["auto", "跟随系统"],
  ];
  const alert = new Alert();
  alert.title = "组件主题";
  alert.message = `当前：${current}`;
  modes.forEach(([, label]) => alert.addAction(label));
  alert.addCancelAction("取消");
  const choice = await alert.presentSheet();
  return choice === -1 ? current : modes[choice][0];
}

async function chooseVisibleProviders(currentHidden) {
  const hidden = new Set(currentHidden);
  while (true) {
    const alert = new Alert();
    alert.title = "显示服务";
    alert.message = "点击切换；至少保留一个服务";
    PROVIDERS.forEach((provider) =>
      alert.addAction(
        `${hidden.has(provider.id) ? "○" : "✓"} ${provider.name}`
      )
    );
    alert.addCancelAction("完成");
    const choice = await alert.presentSheet();
    if (choice === -1) return [...hidden];
    const id = PROVIDERS[choice].id;
    if (hidden.has(id)) hidden.delete(id);
    else if (hidden.size < PROVIDERS.length - 1) hidden.add(id);
  }
}

async function chooseProviderOrder(currentOrder) {
  const order = [...currentOrder];
  while (true) {
    const alert = new Alert();
    alert.title = "服务顺序";
    alert.message = "点击服务使其上移一位";
    order.forEach((id, index) => {
      const provider = PROVIDERS.find((item) => item.id === id);
      alert.addAction(`${index + 1}. ${provider.name}`);
    });
    alert.addCancelAction("完成");
    const choice = await alert.presentSheet();
    if (choice === -1) return order;
    if (choice > 0) {
      [order[choice - 1], order[choice]] = [order[choice], order[choice - 1]];
    }
  }
}

async function chooseOption(title, current, options) {
  const alert = new Alert();
  alert.title = title;
  alert.message = `当前：${current}`;
  options.forEach(([value, label]) => alert.addAction(label));
  alert.addCancelAction("取消");
  const choice = await alert.presentSheet();
  return choice === -1 ? current : options[choice][0];
}

async function configure(settings) {
  while (true) {
    const sheet = new Alert();
    sheet.title = APP.name;
    sheet.message = "密钥仅保存在 iOS Keychain";
    PROVIDERS.filter((item) => !item.manual).forEach((item) =>
      sheet.addAction(
        `${getSecret(item.id) ? "✓ " : ""}${item.keyLabel}`
      )
    );
    sheet.addAction(
      `Codex Account ID：${settings.codexAccountId ? "已配置" : "自动识别"}`
    );
    sheet.addAction(`SerpBase 剩余额度：${settings.serpBaseCredits}`);
    sheet.addAction(`主题：${settings.themeMode}`);
    sheet.addAction(
      `显示服务：${PROVIDERS.length - settings.hiddenProviders.length} 个`
    );
    sheet.addAction("服务顺序");
    sheet.addAction(`刷新频率：${settings.refreshMinutes} 分钟`);
    sheet.addAction(`缓存时长：${settings.cacheHours} 小时`);
    sheet.addAction(
      `Kimi 区域：${settings.kimiRegion === "cn" ? "中国站" : "国际站"}`
    );
    sheet.addDestructiveAction("恢复默认 UI");
    sheet.addCancelAction("完成");
    const choice = await sheet.presentSheet();
    if (choice === -1) break;

    const keyProviders = PROVIDERS.filter((item) => !item.manual);
    if (choice < keyProviders.length) {
      const provider = keyProviders[choice];
      const value = await promptText(
        provider.keyLabel,
        "留空保存会删除已有密钥",
        getSecret(provider.id),
        true
      );
      if (value !== null) setSecret(provider.id, value);
    } else if (choice === keyProviders.length) {
      const value = await promptText(
        "Codex Account ID",
        "通常可从 Access Token 自动识别；自动识别失败时再填写",
        settings.codexAccountId
      );
      if (value !== null) settings.codexAccountId = value;
    } else if (choice === keyProviders.length + 1) {
      const value = await promptText(
        "SerpBase 剩余额度",
        "SerpBase 暂无公开余额 API，请从控制台复制",
        settings.serpBaseCredits
      );
      if (value !== null && Number.isFinite(Number(value))) {
        settings.serpBaseCredits = Math.max(0, Number(value));
      }
    } else if (choice === keyProviders.length + 2) {
      settings.themeMode = await chooseThemeMode(settings.themeMode);
    } else if (choice === keyProviders.length + 3) {
      settings.hiddenProviders = await chooseVisibleProviders(
        settings.hiddenProviders
      );
    } else if (choice === keyProviders.length + 4) {
      settings.providerOrder = await chooseProviderOrder(
        settings.providerOrder
      );
    } else if (choice === keyProviders.length + 5) {
      settings.refreshMinutes = await chooseOption(
        "刷新频率",
        settings.refreshMinutes,
        [[15, "15 分钟"], [30, "30 分钟"], [60, "60 分钟"]]
      );
    } else if (choice === keyProviders.length + 6) {
      settings.cacheHours = await chooseOption(
        "缓存时长",
        settings.cacheHours,
        [[6, "6 小时"], [12, "12 小时"], [24, "24 小时"], [48, "48 小时"]]
      );
    } else if (choice === keyProviders.length + 7) {
      settings.kimiRegion = await chooseOption(
        "Kimi 区域",
        settings.kimiRegion,
        [["cn", "中国站（CNY）"], ["international", "国际站（USD）"]]
      );
    } else {
      settings.themeMode = "dark";
      settings.refreshMinutes = CONFIG.refreshMinutes;
      settings.cacheHours = CONFIG.cacheHours;
      settings.kimiRegion = CONFIG.kimiRegion;
      settings.hiddenProviders = [...CONFIG.hiddenProviders];
      settings.providerOrder = [...CONFIG.providerOrder];
    }
    saveSettings(settings);
  }
}

async function main() {
  const settings = loadSettings();
  if (!config.runsInWidget) await configure(settings);
  const items = await loadBalances(settings);
  const widget = createWidget(items, settings);
  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else {
    await widget.presentMedium();
  }
  Script.complete();
}

await main();
