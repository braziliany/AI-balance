# v2.3.0 自动化测试报告

日期：2026-10-29（Asia/Shanghai）。基线：本地 HEAD a7f1607（v2.2.0）。环境：Windows，Node.js v24.21.0。

## 结论

G1–G4 自动化验证通过。G5 iPhone 真机验收：用户已明确确认通过。
本次授权将已验收代码推送 main，不创建 Tag 或 GitHub Release。未启动本地开发/预览服务器。

## 执行与结果

`npm test`：原有 10 组测试和新增 2 组测试全部通过。

| 测试组 | 验证内容 | 结果 |
|---|---|---|
| scriptable-runtime | 所有生产脚本无 Node 专用依赖；历史模块接口可用 | PASS |
| installer | 单文件清单、版本判断、发布说明、清单格式 | PASS |
| installer-atomic | 多写入事务异常恢复原文件 | PASS |
| widget-core | 配置迁移、排序/隐藏、阈值、设置保存与凭据脱敏 | PASS |
| provider-contract | 单文件内置三个 Provider 标准化契约 | PASS |
| provider-fetch | 单文件内置三个 Provider URL、鉴权及请求结果 | PASS |
| codex-provider | Codex 时间窗及重置字段变体 | PASS |
| muteki-provider | Muteki 钱包、缺失字段、鉴权与错误 | PASS |
| cache-history | 旧缓存、过期、回退、历史、低余额判断 | PASS |
| release-integrity | 主脚本/安装器/manifest/npm 版本一致；保留模块与图标 | PASS |
| standalone | 无模块加载调用、语法和作用域、内联源码等价、新旧 Provider fixtures、请求和数据读写对比、六种渲染树、新装无模块完整组件流程 | PASS |
| installer-singlefile | 安装成功、旧清单安全回退、下载/标记失败、部分写入回滚、新装失败清理、写后损坏回滚、取消及共享文件保留 | PASS |

离线验收安装器也使用相同安装测试运行成功、部分写入失败、新装失败、写后损坏、取消五种情景；安装主脚本与交付主脚本逐字节相同。交付脚本复制和 SHA-256 校验通过。原始日志见 `test-output.txt`。

## Gate 证据

- G1 PASS：AI-Balance.js 无 importModule 调用、无 module.exports，异步语法解析通过；独立 VM 不提供加载器或旧模块仍完成主流程。
- G2 PASS：现有全部测试通过；Core/Provider 内联代码与 v2.2.0 源码等价；新旧尺寸×主题渲染对象树一致（仅版本号归一化）。
- G3 PASS：settingsVersion 9、ai-balance.* Keychain 标识、settings/cache/history 路径不变；旧配置、缓存与历史读写及离线回退新旧对比一致。
- G4 PASS：manifest 与内置资源只含 AI-Balance；事务回滚、写后校验与共享文件保护通过。LPL/Core/Providers 历史源码未修改。
- G5 PASS（用户确认）：用户在本次推送指令中明确确认 iPhone 真机验收通过。自动化环境未直接连接设备；未提供设备型号、系统版本或逐项截图，不据此补写这些信息。
- G6：已授权推送 main；Tag / GitHub Release 不在本次范围。

## 自动化的边界

渲染验证使用 Scriptable API 模拟及新旧对象树对比，不能证明 iOS 实际字体、截断、桌面调度和像素效果。请求使用脱敏 fixtures，不验证真实服务可用性或有效凭据。回滚模拟可恢复写入错误；设备断电、进程被系统终止、磁盘持续不可写及 iCloud 冲突仍需恢复备份，不能声称绝对原子。共享设计系统源码和导出未变，但其他项目在用户设备上的执行需真机确认。

## 重现

1. `npm test`
2. `node scripts/prepare-acceptance.js`
3. `node tests/installer-singlefile.test.js "F:\共享文件夹\AI-Balance-v2.3.0\Installer-Acceptance.js"`
4. `git diff --check`

打包脚本仅复制文件和生成离线验收包，不执行网络发布。
