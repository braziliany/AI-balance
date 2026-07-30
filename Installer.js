// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: download;

/**
 * AI Balance 一键安装器
 *
 * 首次手动复制本文件并运行；以后再次运行即可检查更新或重新安装。
 * 远程仓库：https://github.com/braziliany/AI-balance
 */

const CONFIG = {
  version: "1.8.0",
  manifestUrl:
    "https://raw.githubusercontent.com/braziliany/AI-balance/main/manifest.json",
  changelogUrl:
    "https://raw.githubusercontent.com/braziliany/AI-balance/main/CHANGELOG.md",
  resources: [
    {
      scriptName: "LPL-Design-System",
      sourceUrl:
        "https://raw.githubusercontent.com/braziliany/AI-balance/main/LPL-Design-System.js",
      marker: "LPL Scriptable Design System",
    },
    {
      scriptName: "AI-Balance",
      sourceUrl:
        "https://raw.githubusercontent.com/braziliany/AI-balance/main/AI-Balance.js",
      marker: 'importModule("LPL-Design-System")',
    },
    {
      scriptName: "AI Balance Installer",
      sourceUrl:
        "https://raw.githubusercontent.com/braziliany/AI-balance/main/Installer.js",
      marker: "AI Balance 一键安装器",
    },
  ],
};

function normalizeManifest(value) {
  if (!value || typeof value !== "object") {
    throw new Error("远程 manifest 格式无效");
  }
  if (!/^\d+\.\d+\.\d+$/.test(String(value.version || ""))) {
    throw new Error("远程 manifest 缺少有效版本号");
  }
  if (!Array.isArray(value.resources) || !value.resources.length) {
    throw new Error("远程 manifest 没有安装资源");
  }
  for (const resource of value.resources) {
    if (!resource.scriptName || !resource.sourceUrl || !resource.marker) {
      throw new Error("远程 manifest 资源字段不完整");
    }
    if (!String(resource.sourceUrl).startsWith("https://")) {
      throw new Error("远程 manifest 包含非 HTTPS 地址");
    }
  }
  return value;
}

function extractVersion(content) {
  const match = String(content || "").match(
    /\bversion\s*:\s*["'](\d+\.\d+\.\d+)["']/
  );
  return match ? match[1] : null;
}

function compareVersions(left, right) {
  const a = String(left || "0.0.0").split(".").map(Number);
  const b = String(right || "0.0.0").split(".").map(Number);
  for (let index = 0; index < 3; index++) {
    if ((a[index] || 0) < (b[index] || 0)) return -1;
    if ((a[index] || 0) > (b[index] || 0)) return 1;
  }
  return 0;
}

function extractReleaseNotes(changelog, version) {
  const lines = String(changelog || "").split(/\r?\n/);
  const heading = `## ${version} `;
  const start = lines.findIndex((line) => line.startsWith(heading));
  if (start === -1) return "";

  const notes = [];
  for (let index = start + 1; index < lines.length; index++) {
    if (lines[index].startsWith("## ")) break;
    if (lines[index].trim()) notes.push(lines[index].trim());
  }
  return notes.slice(0, 6).join("\n");
}

async function downloadText(url) {
  const request = new Request(url);
  request.timeoutInterval = 20;
  const content = await request.loadString();
  const status = request.response ? request.response.statusCode : 200;
  if (status < 200 || status >= 300) {
    throw new Error(`下载失败（HTTP ${status}）`);
  }
  return content;
}

async function downloadResource(resource) {
  const content = await downloadText(resource.sourceUrl);
  if (!content.includes(resource.marker)) {
    throw new Error(`${resource.scriptName} 下载内容校验失败`);
  }
  return { ...resource, content };
}

async function loadReleaseConfig() {
  try {
    return normalizeManifest(
      JSON.parse(await downloadText(CONFIG.manifestUrl))
    );
  } catch (error) {
    console.warn(`远程 manifest 获取失败，使用内置资源：${error}`);
    return {
      version: CONFIG.version,
      changelogUrl: CONFIG.changelogUrl,
      resources: CONFIG.resources,
    };
  }
}

async function readExistingFile(fm, path) {
  if (!fm.fileExists(path)) return null;
  if (!fm.isFileDownloaded(path)) {
    await fm.downloadFileFromiCloud(path);
  }
  return fm.readString(path);
}

async function installDownloads(downloads) {
  const fm = FileManager.iCloud();
  const directory = fm.documentsDirectory();
  const backups = [];

  try {
    for (const resource of downloads) {
      const path = fm.joinPath(directory, `${resource.scriptName}.js`);
      backups.push({
        path,
        content: await readExistingFile(fm, path),
      });
      fm.writeString(path, resource.content);
    }
  } catch (error) {
    for (const backup of backups.reverse()) {
      if (backup.content === null) {
        if (fm.fileExists(backup.path)) fm.remove(backup.path);
      } else {
        fm.writeString(backup.path, backup.content);
      }
    }
    throw error;
  }

  return downloads.map((resource) => resource.scriptName);
}

async function main() {
  try {
    const release = await loadReleaseConfig();
    // 全部下载并验证成功后才写入本地，避免半安装状态。
    const downloads = await Promise.all(
      release.resources.map(downloadResource)
    );
    const mainResource = downloads.find(
      (resource) => resource.scriptName === "AI-Balance"
    );
    const remoteVersion =
      extractVersion(mainResource?.content) || release.version;

    const fm = FileManager.iCloud();
    const localMainPath = fm.joinPath(
      fm.documentsDirectory(),
      "AI-Balance.js"
    );
    const localContent = await readExistingFile(fm, localMainPath);
    const localVersion = extractVersion(localContent);
    const comparison = localVersion
      ? compareVersions(localVersion, remoteVersion)
      : -1;

    let releaseNotes = "";
    try {
      releaseNotes = extractReleaseNotes(
        await downloadText(release.changelogUrl || CONFIG.changelogUrl),
        remoteVersion
      );
    } catch (error) {
      console.warn(`更新说明获取失败：${error}`);
    }

    const alert = new Alert();
    alert.title = localVersion
      ? comparison < 0
        ? "发现 AI Balance 新版本"
        : comparison === 0
          ? "重新安装 AI Balance"
          : "远端版本较旧"
      : "安装 AI Balance";
    alert.message = [
      `本地：${localVersion || "未安装"}`,
      `远端：${remoteVersion}`,
      releaseNotes ? `\n更新内容：\n${releaseNotes}` : "",
      "\nKeychain 密钥、设置与余额缓存不会被覆盖。",
    ].join("\n");

    if (comparison > 0) {
      alert.addDestructiveAction("降级安装");
    } else {
      alert.addAction(
        localVersion
          ? comparison < 0
            ? "更新"
            : "重新安装"
          : "安装"
      );
    }
    alert.addCancelAction("取消");

    if ((await alert.present()) === -1) {
      Script.complete();
      return;
    }

    const installed = await installDownloads(downloads);
    const done = new Alert();
    done.title = "安装完成";
    done.message =
      `已安装：\n${installed.join("\n")}\n\n` +
      "以后只需运行 AI Balance Installer 即可更新。";
    done.addAction("打开 Scriptable");
    await done.present();
    Safari.open("scriptable://");
  } catch (error) {
    const failed = new Alert();
    failed.title = "安装失败";
    failed.message = String(error?.message || error);
    failed.addAction("确定");
    await failed.present();
  }

  Script.complete();
}

await main();
