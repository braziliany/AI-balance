// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: wallet;

/**
 * AI Balance Widget
 * DeepSeek / StepFun / OpenAI / SerpBase / Kimi 余额概览
 *
 * 依赖：LPL-Design-System.js（与本脚本放在 Scriptable 同一目录）
 * 首次在 Scriptable App 内运行会打开配置菜单，密钥保存于 iOS Keychain。
 */

const APP = {
  name: "AI Balance",
  version: "1.1.0",
  settingsVersion: 2,
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
  openAIMonthlyBudgetUSD: 0,
  serpBaseCredits: 0,
};

const PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    shortName: "DS",
    color: "yellow",
    keyLabel: "DeepSeek API Key",
    fetch: fetchDeepSeek,
  },
  {
    id: "stepfun",
    name: "StepFun",
    shortName: "SF",
    color: "orange",
    keyLabel: "StepFun API Key",
    fetch: fetchStepFun,
  },
  {
    id: "openai",
    name: "OpenAI",
    shortName: "OA",
    color: "red",
    keyLabel: "OpenAI Admin Key",
    fetch: fetchOpenAI,
  },
  {
    id: "serpbase",
    name: "SerpBase MCP",
    shortName: "SB",
    color: "yellow",
    manual: true,
    fetch: fetchSerpBase,
  },
  {
    id: "kimi",
    name: "Kimi",
    shortName: "KM",
    color: "orange",
    keyLabel: "Kimi API Key",
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
    return {
      ...CONFIG,
      ...stored,
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
  const balances = json.balance_infos || [];
  const item =
    balances.find((value) => value.currency === "CNY") || balances[0];
  if (!item) throw new Error("响应中没有余额");
  return {
    ...money(item.total_balance, item.currency),
    detail: `充值 ${money(item.topped_up_balance, item.currency).display}`,
  };
}

async function fetchStepFun(key) {
  const json = await requestJSON("https://api.stepfun.com/v1/accounts", key);
  const account = json.data || json;
  const result = money(account.balance, account.currency || "CNY");
  return { ...result, detail: "可用余额" };
}

async function fetchKimi(key) {
  const json = await requestJSON(
    "https://api.moonshot.cn/v1/users/me/balance",
    key
  );
  if (json.status === false) throw new Error(json.message || "查询失败");
  const data = json.data || {};
  return {
    ...money(data.available_balance, "CNY"),
    detail: `现金 ${money(data.cash_balance, "CNY").display}`,
  };
}

function monthStartUnix() {
  const now = new Date();
  return Math.floor(
    new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
  );
}

async function fetchOpenAI(key, settings) {
  const url =
    "https://api.openai.com/v1/organization/costs" +
    `?start_time=${monthStartUnix()}&bucket_width=1d&limit=31`;
  const json = await requestJSON(url, key);
  let spent = 0;
  for (const bucket of json.data || []) {
    for (const result of bucket.results || []) {
      spent += Number(result.amount?.value || 0);
    }
  }
  const budget = Number(settings.openAIMonthlyBudgetUSD || 0);
  if (budget > 0) {
    return {
      ...money(Math.max(0, budget - spent), "USD"),
      detail: `本月已用 $${spent.toFixed(2)}`,
    };
  }
  return {
    ...money(spent, "USD"),
    display: `$${spent.toFixed(2)}`,
    detail: "本月成本",
    isUsage: true,
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

async function loadBalances(settings) {
  const cache = readCache();
  const now = Date.now();
  const results = await Promise.all(
    PROVIDERS.map(async (provider) => {
      const key = provider.manual ? "" : getSecret(provider.id);
      if (!provider.manual && !key) {
        return { ...provider, status: "unset", display: "未配置", detail: "点击脚本配置" };
      }
      try {
        const balance = await provider.fetch(key, settings);
        const item = { ...provider, ...balance, status: "ok", updatedAt: now };
        cache[provider.id] = item;
        return item;
      } catch (error) {
        const old = cache[provider.id];
        const freshEnough =
          old && now - Number(old.updatedAt || 0) < settings.cacheHours * 3600000;
        if (freshEnough) {
          return { ...old, ...provider, status: "cached", detail: "缓存数据" };
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
  const color =
    item.status === "error" || item.status === "unset"
      ? palette.muted
      : palette.white;
  addText(row, item.display, compact ? 14 : 17, color, "bold");
}

function addBalanceCard(parent, item, palette) {
  const card = parent.addStack();
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

  const valueColor =
    item.status === "error" || item.status === "unset"
      ? palette.muted
      : palette.white;
  addText(card, item.display, 24, valueColor, "bold");
  card.addSpacer(3);
  addText(card, item.detail, 10, palette.secondary);
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
    addBalanceCard(highlights, items[0], palette);
    highlights.addSpacer(10);
    addBalanceCard(highlights, items[1], palette);
    widget.addSpacer(13);

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
  const updated = new Date();
  const footer = widget.addStack();
  addText(
    footer,
    `${updated.getMonth() + 1}/${updated.getDate()} ${String(
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
    sheet.addAction(`OpenAI 月预算：$${settings.openAIMonthlyBudgetUSD}`);
    sheet.addAction(`SerpBase 剩余额度：${settings.serpBaseCredits}`);
    sheet.addAction(`主题：${settings.themeMode}`);
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
        "OpenAI 月预算",
        "单位 USD；设为 0 时显示本月成本",
        settings.openAIMonthlyBudgetUSD
      );
      if (value !== null && Number.isFinite(Number(value))) {
        settings.openAIMonthlyBudgetUSD = Math.max(0, Number(value));
      }
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
    } else {
      settings.themeMode = "dark";
      settings.refreshMinutes = CONFIG.refreshMinutes;
      settings.cacheHours = CONFIG.cacheHours;
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
