# AI Balance for Scriptable

一个使用 `LPL-Design-System` 的 Scriptable 小组件，汇总：

- DeepSeek：账户可用余额
- StepFun：账户可用余额
- Codex：自动识别可用的 5 小时窗口与每周额度剩余百分比
- SerpBase MCP：手动维护剩余 credits（官方暂未公开余额查询接口）
- Kimi：账户可用余额

各服务使用品牌图标显示。图标首次运行时下载到 Scriptable 本地缓存；网络不可用时会自动回退到字母标志，不影响余额查询。

如果品牌图标没有更新或本地图片损坏，可在主脚本设置中选择“刷新品牌图标”；该操作不会删除密钥、余额缓存或其他设置。

## 安装

### 推荐：一键安装器

1. 首次只需将仓库中的 `Installer.js` 复制到 Scriptable。
2. 把脚本命名为 `AI Balance Installer` 并运行。
3. 安装器会自动下载 `AI-Balance`、`LPL-Design-System` 和最新版安装器。
4. 以后运行 `AI Balance Installer` 即可检查更新或重新安装。
5. 运行 `AI-Balance`，按菜单填入各平台密钥、Codex Access Token 和 SerpBase 剩余额度。
6. 在桌面添加 Scriptable 中号组件并选择 `AI-Balance`。

安装器会先下载并校验所有文件，确认完整后才写入；安装中断时会恢复原文件。更新不会覆盖 Keychain 密钥、设置或余额缓存。安装器会优先读取仓库中的 `manifest.json` 获取版本和资源列表，manifest 不可用时自动回退到内置资源。

### 手动安装

也可以将 `AI-Balance.js` 和 `LPL-Design-System.js` 一起复制到 Scriptable 的 iCloud Drive 目录。

密钥通过 Scriptable `Keychain` 保存，不会写入脚本或设置 JSON。

## 密钥权限

- DeepSeek / StepFun / Kimi：普通 API Key。
- Codex：ChatGPT/Codex Access Token。脚本会优先从 Token 自动识别 Account ID，识别失败时可单独填写。
- SerpBase：无需把 Key 填入本脚本。

Codex Access Token 属于登录凭据，请只在自己的设备间传递，不能提交到 GitHub 或发送给他人。Token 可能会过期；组件出现授权错误时，需要重新填写最新 Token。由于 OpenAI 尚未提供稳定的第三方 Codex 额度 API，这一项属于实验性支持。

推荐使用与 LPL Schedule 相同的中号组件；大号组件会使用余额卡片加明细列表，小号显示前三个已配置项目。请求失败时会使用 24 小时内的本地缓存，并标注为“缓存数据”。

在 Scriptable App 内运行主脚本可以设置服务显示/隐藏和顺序、刷新频率、缓存时长、Kimi 中国站或国际站以及主题。余额低于 ¥10、Codex 剩余低于 20% 或 SerpBase 少于 100 credits 时使用红色警示。点击服务可打开对应平台控制台。

v2.0 起设置界面使用类似 iOS 设置的 WebView 分组页面。修改完成后点击左上角关闭即可统一保存；已有密钥不会载入 WebView，只会显示是否已配置。页面底部仍可打开经典设置菜单。

API 密钥区默认保持精简，点击某个平台后才展开新密钥输入框和清除操作；SerpBase 手动额度与 Codex ID 位于单独的“账户详情”分组。

警示阈值可以自行调整。设置菜单还可以选择小号、中号或大号进行 App 内预览，并生成不包含密钥、Token 和 Account ID 的诊断报告。

如果使用 Kimi 国际站或其他美元余额，可在设置中填写 USD→CNY 参考汇率；大号组件会同时显示美元余额和人民币估算。汇率完全由用户维护，不会自动联网获取，也不构成实时财务报价。

大号组件会显示余额相对上次成功数据的升降变化，以及充值、赠送、现金和代金券明细；Codex 卡片包含五小时剩余额度进度条。

组件还会在 Scriptable 本地保存最多 8 天的余额历史，大号组件可显示相对约 24 小时前和 7 天前的变化。历史文件只包含时间、数值和单位，不包含密钥、Token 或原始接口响应。

如果组件意外显示为浅色，请在 Scriptable App 内运行脚本，选择“主题”，再选择“深蓝主题（与 LPL 一致）”。iOS 组件尺寸由添加组件时选择，脚本无法把已经添加的大号组件自动改成中号。

## 数据接口

- DeepSeek：`GET https://api.deepseek.com/user/balance`
- StepFun：`GET https://api.stepfun.com/v1/accounts`
- Codex：Codex 客户端额度接口（非公开稳定 API，接口变化时会回退缓存）
- Kimi：`GET https://api.moonshot.cn/v1/users/me/balance`
