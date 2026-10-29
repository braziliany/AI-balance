# AI Balance for Scriptable

一个内置 LPL 设计系统的独立 Scriptable 小组件，聚合三个长期使用且可自动查询的数据源：

- DeepSeek：人民币账户总余额与充值余额
- Codex：5 小时额度、周额度及两套独立重置时间
- Muteki：美元钱包余额与今日消费

Provider 图标会缓存在 Scriptable 本地；图标不可用时自动回退到字母标志，不影响余额查询。请求失败时会使用用户设置有效期内的本地缓存，并标注“缓存数据”。

## 安装

### 推荐：一键安装器

1. 将仓库中的 `Installer.js` 复制到 Scriptable，命名为 `AI Balance Installer`。
2. 运行安装器，它只下载并校验 `AI-Balance.js`。安装器自身需手动更新，旧模块不会被删除或覆盖。
3. 运行 `AI-Balance`，配置 DeepSeek API Key、Codex Access Token 和 Muteki API Key。
4. 在桌面添加 Scriptable 小号、中号或大号组件，并选择 `AI-Balance`。

安装器只有在全部资源下载和标记校验成功后才写入；写入失败会恢复原文件。更新不会覆盖 Keychain、设置、余额缓存或历史。

### 手动安装

只需将 `AI-Balance.js` 放入 Scriptable 的 iCloud Drive 目录即可运行，无需安装其他模块。

### v2.3.0 验证状态

全部 12 组自动化测试通过，用户已明确确认 iPhone 真机验收通过。v2.3.0 单文件版本同步至 main；本次不创建 Tag 或 GitHub Release。

验证范围见 [测试报告](docs/v2.3.0/automated-test-report.md)，真机确认见 [验收记录](docs/v2.3.0/iphone-acceptance.md)。

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

- `AI-Balance.js`：唯一运行文件。按 Core → DesignSystem → ProviderAdapters → 生命周期初始化，内置模块各自使用函数作用域隔离。
- `AI-Balance-Core.js`、`AI-Balance-Providers.js`：保留 v2.2.0 模块源码，作为历史参考，不再安装。
- `LPL-Design-System.js`：共享模块源码和导出保持原样，其他 Scriptable 项目可继续引用。
- `tests/fixtures/v2.2.0/AI-Balance.js.txt`：用于新旧生命周期和渲染树的差异回归，不作为运行文件。

本地执行 `npm test` 或 `npm run verify` 运行全部测试。现有 Provider 回归直接加载单文件内置实现，另以保留的 v2.2.0 源码进行行为对比。

Renderer 只消费标准化结果，不直接读取 `balance_infos`、`used_percent`、`primary_window`、`remaining` 或 `usage.today` 等 Provider 私有字段。
