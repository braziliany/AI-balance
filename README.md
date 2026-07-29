# AI Balance for Scriptable

一个使用 `LPL-Design-System` 的 Scriptable 小组件，汇总：

- DeepSeek：账户可用余额
- StepFun：账户可用余额
- OpenAI：本月成本；设置月预算后显示“预算减本月成本”
- SerpBase MCP：手动维护剩余 credits（官方暂未公开余额查询接口）
- Kimi：账户可用余额

## 安装

### 推荐：一键安装器

1. 首次只需将仓库中的 `Installer.js` 复制到 Scriptable。
2. 把脚本命名为 `AI Balance Installer` 并运行。
3. 安装器会自动下载 `AI-Balance`、`LPL-Design-System` 和最新版安装器。
4. 以后运行 `AI Balance Installer` 即可检查更新或重新安装。
5. 运行 `AI-Balance`，按菜单填入各平台密钥、OpenAI 月预算和 SerpBase 剩余额度。
6. 在桌面添加 Scriptable 中号组件并选择 `AI-Balance`。

安装器会先下载并校验所有文件，确认完整后才写入；安装中断时会恢复原文件。更新不会覆盖 Keychain 密钥、设置或余额缓存。

### 手动安装

也可以将 `AI-Balance.js` 和 `LPL-Design-System.js` 一起复制到 Scriptable 的 iCloud Drive 目录。

密钥通过 Scriptable `Keychain` 保存，不会写入脚本或设置 JSON。

## 密钥权限

- DeepSeek / StepFun / Kimi：普通 API Key。
- OpenAI：组织 Admin Key，官方 Costs API 不接受普通项目 Key。
- SerpBase：无需把 Key 填入本脚本。

推荐使用与 LPL Schedule 相同的中号组件；大号组件会使用余额卡片加明细列表，小号显示前三个已配置项目。请求失败时会使用 24 小时内的本地缓存，并标注为“缓存数据”。

如果组件意外显示为浅色，请在 Scriptable App 内运行脚本，选择“主题”，再选择“深蓝主题（与 LPL 一致）”。iOS 组件尺寸由添加组件时选择，脚本无法把已经添加的大号组件自动改成中号。

## 数据接口

- DeepSeek：`GET https://api.deepseek.com/user/balance`
- StepFun：`GET https://api.stepfun.com/v1/accounts`
- OpenAI：`GET https://api.openai.com/v1/organization/costs`
- Kimi：`GET https://api.moonshot.cn/v1/users/me/balance`
