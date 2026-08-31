# AI Balance for Scriptable

一个使用 `LPL-Design-System` 的 Scriptable 小组件，聚合三个长期使用且可自动查询的数据源：

- DeepSeek：人民币账户总余额与充值余额
- Codex：5 小时额度、周额度及两套独立重置时间
- Muteki：美元钱包余额与今日消费

Provider 图标会缓存在 Scriptable 本地；图标不可用时自动回退到字母标志，不影响余额查询。请求失败时会使用用户设置有效期内的本地缓存，并标注“缓存数据”。

## 安装

### 推荐：一键安装器

1. 将仓库中的 `Installer.js` 复制到 Scriptable，命名为 `AI Balance Installer`。
2. 运行安装器，它会下载并校验主脚本、Core、Provider Adapters、设计系统和最新版安装器。
3. 运行 `AI-Balance`，配置 DeepSeek API Key、Codex Access Token 和 Muteki API Key。
4. 在桌面添加 Scriptable 小号、中号或大号组件，并选择 `AI-Balance`。

安装器只有在全部资源下载和标记校验成功后才写入；写入失败会恢复原文件。更新不会覆盖 Keychain、设置、余额缓存或历史。

### 手动安装

将以下文件放入 Scriptable 的同一 iCloud Drive 目录：

- `AI-Balance.js`
- `AI-Balance-Core.js`
- `AI-Balance-Providers.js`
- `LPL-Design-System.js`

## 凭据与安全

- DeepSeek API Key：保存为 `ai-balance.deepseek`
- Codex Access Token：保存为 `ai-balance.codex`
- Muteki API Key：保存为 `ai-balance.muteki`

凭据只进入 Scriptable Keychain 和请求鉴权边界，不写入 settings JSON、cache、history、WebView HTML、diagnostics 或 console。旧版的 StepFun/Kimi Keychain 不会在升级时自动删除，便于回滚旧版本，但新运行时不再读取它们。

Codex 使用非公开稳定的客户端额度接口，Token 可能过期，接口字段也可能变化；请求失败时会按现有缓存策略回退。

## 设置与显示

在 Scriptable App 内运行主脚本，可以维护三组凭据、Codex Account ID、Provider 顺序与隐藏项、刷新频率、缓存时长、主题和预览尺寸。

警示阈值分为：

- 人民币低余额阈值，供 DeepSeek 使用
- 美元低余额阈值，供 Muteki 使用，默认 `$2`
- Codex 剩余额度阈值

`USD → CNY` 参考汇率继续由用户手工维护。大号组件可同时显示 Muteki 美元余额与人民币估算；设置为 `0` 时关闭人民币参考值，不会自动联网获取汇率。

大号组件顶部保留 DeepSeek 与 Codex 卡片。Codex 卡片将 5 小时额度和周额度作为两个等权指标，并分别显示各自重置时间，不再显示进度条。Muteki 明细显示钱包余额、今日消费以及本地计算的日/周余额变化。

组件最多保留约 8 天历史，只保存时间、数值和单位，不保存凭据、账户信息或原始 API 响应。

## 数据接口

- DeepSeek：`GET https://api.deepseek.com/user/balance`
- Codex：Codex 客户端额度接口（实验性）
- Muteki：`GET https://api.muteki.site/v1/usage`

Muteki 使用普通 API Key：

```http
Authorization: Bearer <Muteki API Key>
Accept: application/json
```

脚本读取 `remaining`，缺失时回退到 `balance`；使用 `usage.today.actual_cost` 显示今日消费。不会使用后台 Cookie、登录 JWT、Session 或 `/api/v1/auth/me`。

## Architecture

```text
Provider API
        ↓
Provider Adapter
        ↓
Normalized Provider Result
        ↓
Cache / History / ViewModel
        ↓
Widget Renderer
```

- `AI-Balance-Providers.js`：Provider registry、请求、解析和字段兼容。
- `AI-Balance-Core.js`：标准化、额度窗口、缓存、历史、阈值和数值纯函数。
- `AI-Balance.js`：Scriptable 生命周期、Keychain/本地文件桥接、设置界面和 Renderer。

Renderer 只消费标准化结果，不直接读取 `balance_infos`、`used_percent`、`primary_window`、`remaining` 或 `usage.today` 等 Provider 私有字段。
