# WhatNameFrontend · 统一权限管理前端

基于 Vue 3 的权限管理后台，沿用已确定的原型界面，开始按本地 API 契约实现真实前端。

## 当前进度

10 月 18 日第一阶段的截图仅说明分工和截止日期，未列出验收条件，不能据此判定团队第一阶段全部完成。当前已具备界面原型、前端仓库、系统详细设计、接口规范与 OpenAPI 候选契约。

正式入口已实现账号/手机号密码登录、读取本人有效菜单、用户列表查询与分页、服务端会话注销、401 失效处理，以及网络/权限/响应格式错误提示。真实后端尚未运行，以上通过拦截 HTTP 请求的前端集成测试验证，尚未完成实际联调。角色、资源、授权、人员变动、审计等模块仍需逐步从原型迁移。

正式入口不读取原型 localStorage 数据，不模拟登录成功，不以演示数据兜底。JWT 仅保存在内存，刷新或关闭页面需要重新登录；当前契约没有刷新令牌接口。退出只有在后端确认 `revoked=true` 后才显示成功；失败提示重试。后端仍须对每次业务请求实施真实鉴权。

## 技术栈

| 用途 | 当前技术 |
| --- | --- |
| UI | Vue 3 Composition API、JavaScript ES Modules、原生 CSS |
| 开发与构建 | Vite 6、Node.js / npm、package-lock 锁定依赖 |
| 图标 | lucide-vue-next |
| HTTP | 浏览器 Fetch API、AbortController |
| 验证 | Playwright：原型回归与正式入口接口集成测试 |

当前未使用 TypeScript、Vue Router、Pinia、Axios 或 UI 组件库。后端设计要求 Java + Spring Boot、MySQL 8；这些属于后端，不是本仓库已实现的技术。

## 启动正式前端

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

默认访问终端给出的地址，通常为 http://localhost:5173。`.env.local` 不提交 Git；这里仅配置地址与公开应用编码，不填写密码、JWT、私钥或服务端凭据。

```dotenv
API_PROXY_TARGET=http://127.0.0.1:8080
VITE_API_BASE_URL=/api/v1
VITE_IAM_APP_CODE=IAM
```

`8080` 是可修改的本地联调默认值，不代表已发现正在运行的后端。`IAM` 是暂定权限平台应用编码，必须与后端登记值一致，修改配置后重启 Vite。开发服务器把 `/api` 请求代理至后端。生产部署需由反向代理转发 `/api`，或配置真实 HTTPS API 地址并在后端允许对应跨域请求。

后端未启动时可以查看登录界面，提交登录会明确显示连接失败，不会进入演示控制台。

## 原型预览

```powershell
npm.cmd run dev:demo
```

原型位于 `src/demo/`，用于核对既定界面和业务交互，业务数据存储于浏览器 localStorage。该目录是仍被使用的原型与回归测试资源，不是备份。演示仅在开发模式启用，生产构建不包含原型组件和数据。

## 代码组织

- `src/App.vue`：正式登录入口。
- `src/api/client.js`：统一 JSON 协议、Bearer 令牌、超时、错误与请求取消处理。
- `src/session.js`：登录、本人菜单、内存会话、过期与退出。
- `src/views/`：正式控制台与服务端分页用户列表。
- `src/demo/`：原型及其业务模拟，独立于正式业务数据。
- `tests/`：持续使用的测试，接口模拟只出现在测试内。
- `docs/`：必要的功能与设计资料。

## 当前接入的契约

| 接口 | 用途 |
| --- | --- |
| `POST /api/v1/auth/login` | 账号密码、手机号密码登录 |
| `GET /api/v1/auth/menus?appCode=...` | 获取本人在权限平台的有效菜单 |
| `GET /api/v1/users?keyword=...&page=...&pageSize=20` | 查询管理范围内的用户 |
| `POST /api/v1/auth/logout` | 注销服务端会话 |

ID 按字符串处理，避免 BIGINT 精度丢失。当前用户菜单入口识别 `IAM_USERS_VIEW` 或 `/users`，实际菜单编码、路径、应用编码和状态枚举需与后端冻结。其余菜单显示开发状态，不会跳到模拟页面。浏览器不调用仅供可信业务服务使用的 `/auth/check`，不持有 HR/OA 服务密钥。

## 测试与构建

需要 Node.js 和 Google Chrome，保持 5174、5175 端口空闲：

```powershell
npm.cmd test
npm.cmd run build
```

测试自动启动独立的原型服务与正式入口服务，结束后关闭。正式入口测试使用拦截 HTTP 响应验证请求字段、Bearer、菜单访问、分页搜索、失败、过期与退出；不能替代真实后端联调、安全验证和性能验收。

如果没有 Chrome，可安装 Playwright Chromium：

```powershell
npx.cmd playwright install chromium
$env:PLAYWRIGHT_CHANNEL = 'chromium'
npm.cmd test
```

`dist/`、`test-results/`、`playwright-report/` 均为可再生输出，不提交仓库，验证完毕后可删除。保留 `node_modules/` 供本地运行使用，不提交仓库。项目不保留一次性修改脚本、设计审查截图、文本提取副本或备份文件。

## 设计依据与后续工作

- [页面功能文档](docs/统一权限管理系统功能文档.docx)
- [系统详细设计](docs/design/01_系统详细设计说明书.md)
- [API 规范与验收矩阵](docs/design/02_API接口设计规范.md)
- [OpenAPI 候选契约](docs/design/03_OpenAPI_3.0_候选契约.yaml)

设计文件是实现依据，不表示后端已实现或已通过验收。真实域名、权限平台应用编码、管理员身份展示、菜单编码/路径、状态枚举，以及部分安全与 HR/OA 协议仍须联调确认；文档中图件部分未随原资料提供，正文仍可独立阅读。

下一步先启动后端并联调上述登录、菜单、列表与退出接口，再接入临时账号创建/状态维护、角色资源配置、按依据授权回收、HR 处理结果及审计。管理员范围、幂等、版本冲突、批量部分失败、真实审计和实时撤权均以服务端结果为准。原型测试通过不代表这些后端能力已经完成。
