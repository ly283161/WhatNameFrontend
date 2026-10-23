> 当前验收按 [2026-10-23 课程作业简化范围](../backend/docs/COURSEWORK_SCOPE.md)。旧版持久批量、在线事件恢复、递归委派及生产指标不再适用；旧版已提交留档。

# 权限管理控制台

Vue 3 + Vite。只保留正式管理页面，管理账号、组织、资源、角色、授权、管理员和审计。

## 启动

```sh
npm ci
npm run dev
```

复制 .env.example 为 .env.local 按需修改。API_PROXY_TARGET 默认 http://127.0.0.1:8080，浏览器 API 路径 /api/v1，VITE_IAM_APP_CODE=IAM 须与后端一致。VITE_* 对浏览器公开，不能放密钥。

真实账号和权限需要后端初始化；请求失败不回退到模拟数据。JWT 保存在内存，刷新后重新登录。平台自身管理也使用这套页面。

## 开发与测试

| 命令 | 用途 |
| --- | --- |
| npm run dev | 连接真实后端 |
| npm run dev:mock | 同一页面 + 本地模拟 API |
| npm test | 正式页面交互与契约回归 |
| npm run build | 构建至 dist |
| npm run format:check | 格式检查 |

测试使用本机 Chrome 和 5175、5176 端口。模拟账号 admin / 123456、验证码 123456 仅供本地测试，不是后端初始化账号。

dev/fixtures.json 是模拟测试所需的演示夹具，不是数据库种子。它保留 10000 员工、111 部门、18 应用及 359 功能点，电话使用合成的完整演示号码，字段为 phone，模拟 ID 不作为真实授权事实。模拟服务不进入正式构建。生产部署需将 /api 反向代理至后端，Vite 代理不会进入 dist。

## 阅读代码

- src/views：功能页面；src/components：公共组件。
- src/api：请求与响应校验；session.js、access.js：会话与按钮显示。
- tests：正式页面测试；dev：模拟测试适配器。
- 工作区统一 [功能说明](../backend/docs/GUIDE.md)、[设计依据](../backend/docs/contracts/README.md)、[测试记录](../backend/docs/TESTING.md)。

按钮显示不能替代后端鉴权。受控初始化入口见后端功能说明；真实页面端到端验收仍待完成。
