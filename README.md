# AI Balance for Scriptable

一个使用 `LPL-Design-System` 的 Scriptable 小组件，汇总：

- DeepSeek：账户可用余额
- StepFun：账户可用余额
- Codex：5 小时窗口与每周额度剩余百分比
- SerpBase MCP：手动维护剩余 credits（官方暂未公开余额查询接口）
- Kimi：账户可用余额

## 安装

### 推荐：一键安装器

1. 首次只需将仓库中的 `Installer.js` 复制到 Scriptable。
2. 把脚本命名为 `AI Balance Installer` 并运行。
3. 安装器会自动下载 `AI-Balance`、`LPL-Design-System` 和最新版安装器。
4. 以后运行 `AI Balance Installer` 即可检查更新或重新安装。
5. 运行 `AI-Balance`，按菜单填入各平台密钥、Codex Access Token 和 SerpBase 剩余额度。
6. 在桌面添加 Scriptable 中号组件并选择 `AI-Balance`。

安装器会先下载并校验所有文件，确认完整后才写入；安装中断时会恢复原文件。更新不会覆盖 Keychain 密钥、设置或余额缓存。

### 手动安装

也可以将 `AI-Balance.js` 和 `LPL-Design-System.js` 一起复制到 Scriptable 的 iCloud Drive 目录。

密钥通过 Scriptable `Keychain` 保存，不会写入脚本或设置 JSON。

## 密钥权限

- DeepSeek / StepFun / Kimi：普通 API Key。
- Codex：ChatGPT/Codex Access Token。脚本会优先从 Token 自动识别 Account ID，识别失败时可单独填写。
- SerpBase：无需把 Key 填入本脚本。

Codex Access Token 属于登录凭据，请只在自己的设备间传递，不能提交到 GitHub 或发送给他人。Token 可能会过期；组件出现授权错误时，需要重新填写最新 Token。由于 OpenAI 尚未提供稳定的第三方 Codex 额度 API，这一项属于实验性支持。

推荐使用与 LPL Schedule 相同的中号组件；大号组件会使用余额卡片加明细列表，小号显示前三个已配置项目。请求失败时会使用 24 小时内的本地缓存，并标注为“缓存数据”。

如果组件意外显示为浅色，请在 Scriptable App 内运行脚本，选择“主题”，再选择“深蓝主题（与 LPL 一致）”。iOS 组件尺寸由添加组件时选择，脚本无法把已经添加的大号组件自动改成中号。

## 数据接口

- DeepSeek：`GET https://api.deepseek.com/user/balance`
- StepFun：`GET https://api.stepfun.com/v1/accounts`
- Codex：Codex 客户端额度接口（非公开稳定 API，接口变化时会回退缓存）
- Kimi：`GET https://api.moonshot.cn/v1/users/me/balance`
