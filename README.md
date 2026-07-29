# AI Balance for Scriptable

一个使用 `LPL-Design-System` 的 Scriptable 小组件，汇总：

- DeepSeek：账户可用余额
- StepFun：账户可用余额
- OpenAI：本月成本；设置月预算后显示“预算减本月成本”
- SerpBase MCP：手动维护剩余 credits（官方暂未公开余额查询接口）
- Kimi：账户可用余额

## 安装

1. 将 `AI-Balance.js` 复制到 Scriptable 的 iCloud Drive 目录。
2. 将 LPL-scriptable 项目中的 `LPL-Design-System.js` 放到同一目录。
3. 在 Scriptable App 中直接运行 `AI-Balance`。
4. 按菜单填入各平台密钥、OpenAI 月预算和 SerpBase 剩余额度。
5. 在桌面添加 Scriptable 小组件并选择 `AI-Balance`。

密钥通过 Scriptable `Keychain` 保存，不会写入脚本或设置 JSON。

## 密钥权限

- DeepSeek / StepFun / Kimi：普通 API Key。
- OpenAI：组织 Admin Key，官方 Costs API 不接受普通项目 Key。
- SerpBase：无需把 Key 填入本脚本。

推荐中号或大号组件；小号显示前三个已配置项目。请求失败时会使用 24 小时内的本地缓存，并标注为“缓存数据”。

## 数据接口

- DeepSeek：`GET https://api.deepseek.com/user/balance`
- StepFun：`GET https://api.stepfun.com/v1/accounts`
- OpenAI：`GET https://api.openai.com/v1/organization/costs`
- Kimi：`GET https://api.moonshot.cn/v1/users/me/balance`

