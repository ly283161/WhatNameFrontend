# WhatNameFrontend

统一权限管理系统的前端管理控制台，用于管理账号、组织、应用资源、角色授权、管理员范围和审计日志。

项目支持连接真实后端，也提供独立的开发模拟服务和界面原型。当前管理页面已按第二阶段接口适配，真实环境的端到端验收仍需完成后端配置与联调。

## 功能概览

| 模块 | 主要功能 |
| --- | --- |
| 登录与凭据 | 账号或手机号密码登录、验证码发送、首次设置密码、重置密码、注销 |
| 工作台与账号 | 管理入口、统计信息、账号分页搜索、临时账号创建、账号暂停与恢复 |
| 应用资源 | 应用、目录与菜单维护、API 登记、菜单与 API 映射 |
| 角色管理 | 角色创建与维护、启用与停用、角色菜单配置 |
| 权限分配 | 单人或多人授权、按授权依据回收、批量任务进度与结果、授权历史 |
| 组织管理 | 部门查询、部门人员查看、部门冻结与解冻 |
| 管理员管理 | 管理范围查询、管理员任命与撤销、可授权角色配置 |
| 审计日志 | 管理操作、接口权限校验、统一账号登录记录的查询与详情 |

页面入口和操作按钮根据当前账号的权限与管理范围显示，最终操作资格由后端校验。

## 技术栈

- **界面**：Vue 3、JavaScript、原生 CSS
- **构建**：Vite 6、`@vitejs/plugin-vue`
- **图标**：Lucide Vue
- **接口请求**：浏览器 Fetch API
- **自动化测试**：Playwright

## 快速开始

### 环境要求

- Node.js 22 或更高版本
- npm（使用仓库中的 `package-lock.json` 安装依赖）
- 运行自动化测试时，需要本机 Chrome，或已安装的 Playwright Chromium

以下命令均在项目根目录执行。Windows PowerShell 如无法执行 `npm.ps1`，可将 `npm` 替换为 `npm.cmd`。

### 安装依赖

```bash
npm ci
```

### 使用开发模拟服务

无需启动后端，可直接查看管理页面和验证交互：

```bash
npm run dev:mock
```

打开终端输出的访问地址，默认端口为 `5173`。

| 项目 | 开发环境取值 |
| --- | --- |
| 登录账号 | `admin` |
| 登录密码 | `123456` |
| 模拟验证码 | `123456` |

上述凭据仅用于开发模拟服务。模拟写入保存在服务内存中，重启服务后恢复初始数据。数据说明见[开发说明](docs/development.md#数据依据)。

### 连接真实后端

1. 启动后端服务，并准备可登录的账号及管理权限。
2. 将 `.env.example` 复制为 `.env.local`，按实际环境调整配置：

   ```dotenv
   API_PROXY_TARGET=http://127.0.0.1:8080
   VITE_API_BASE_URL=/api/v1
   VITE_IAM_APP_CODE=IAM
   ```

3. 启动前端：

   ```bash
   npm run dev
   ```

默认情况下，浏览器请求 `/api/v1`，Vite 将 `/api` 请求代理到 `http://127.0.0.1:8080`。修改环境变量后需重启开发服务。

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `API_PROXY_TARGET` | `http://127.0.0.1:8080` | 开发服务器的后端代理目标，仅用于开发代理 |
| `VITE_API_BASE_URL` | `/api/v1` | 浏览器使用的 API 基础路径，构建时写入产物 |
| `VITE_IAM_APP_CODE` | `IAM` | 权限平台应用编码，需与后端注册值一致 |

`VITE_` 前缀的变量会暴露给浏览器，不应填写密钥或其他服务端凭据。

### 查看界面原型

```bash
npm run dev:demo
```

此模式加载 `src/demo/PrototypeApp.vue`，用于查看原有界面原型。真实后端与开发模拟模式均使用正式管理页面。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器，连接真实后端 |
| `npm run dev:mock` | 启动带模拟 API 的开发服务器，仅监听本机地址 |
| `npm run dev:demo` | 启动界面原型 |
| `npm run build` | 构建生产产物，输出至 `dist/` |
| `npm run preview` | 本地预览已生成的构建产物 |
| `npm test` | 运行 Playwright 自动化测试 |
| `npm run test:ui` | 打开 Playwright 测试交互界面 |

## 自动化测试

默认使用本机 Chrome：

```bash
npm test
```

测试配置会自动启动三个开发服务，分别占用 `5174`、`5175` 和 `5176` 端口，运行原型、正式页面、模拟接口及第二阶段接口契约相关测试。执行前请确保这些端口可用。

如需使用 Playwright Chromium，在 PowerShell 中执行：

```powershell
npx playwright install chromium
$env:PLAYWRIGHT_CHANNEL = 'chromium'
npm test
```

失败截图和追踪文件输出至 `test-results/`。自动化测试中的模拟响应与契约校验不能替代真实后端联调。

## 构建与部署

```bash
npm run build
npm run preview
```

将 `dist/` 部署到静态文件服务器。默认 API 路径为 `/api/v1`，生产环境需配置 `/api` 到真实后端的反向代理；`API_PROXY_TARGET` 和 Vite 开发代理不会在部署后生效。若修改 `VITE_API_BASE_URL`，需重新构建。

`npm run preview` 用于本地检查构建产物，不提供生产后端代理。标准生产构建不包含开发模拟服务、模拟账号或模拟数据集。

## 项目结构

```text
WhatNameFrontend/
├── dev/                    # 开发模拟 API 与数据集
├── docs/                   # 开发说明、需求与设计资料
│   └── design/             # 详细设计、接口规范与候选 OpenAPI 契约
├── public/                 # 静态资源
├── src/
│   ├── api/                # Fetch 客户端与接口数据校验
│   ├── components/         # 表格、弹窗、详情等公共组件
│   ├── composables/        # 列表、操作与批量任务逻辑
│   ├── demo/               # 界面原型
│   ├── views/              # 管理功能页面
│   ├── access.js           # 前端权限判断
│   ├── session.js          # 会话与权限状态
│   ├── App.vue             # 管理控制台入口
│   └── main.js             # 应用挂载与模式选择
├── tests/                  # Playwright 自动化测试
├── .env.example            # 真实后端配置示例
├── playwright.config.js    # 测试项目与开发服务配置
└── vite.config.js          # 构建、开发代理与模拟服务配置
```

## 联调说明

- JWT 仅保存在内存中，刷新页面后需要重新登录。真实接口不可用时会显示错误，不自动回退到模拟数据。
- 人员变动列表及处理结果仍需后端提供独立的查询契约，当前不应视为已完成该业务流程。
- 模拟服务用于前端交互和接口契约验证。HR/OA 对接、服务端权限校验、签名、持久化审计等链路需在真实后端完成验证。

具体接口范围、批量任务协议及待确认事项见[开发说明](docs/development.md)。

## 相关文档

- [开发说明](docs/development.md)
- [系统详细设计说明书](docs/design/01_系统详细设计说明书.md)
- [API 接口设计规范](docs/design/02_API接口设计规范.md)
- [OpenAPI 3.0 候选契约](docs/design/03_OpenAPI_3.0_候选契约.yaml)
- [系统功能文档](docs/统一权限管理系统功能文档.docx)
- [后端仓库](https://github.com/Ye331/WhatNameBackend)
