# 统一权限管理控制台

Vue 3 + Vite。用户账号、角色、应用资源、权限分配、组织、日志和 OA/HR 业务演示共用一套界面。

```powershell
npm ci
npm run dev
```

后端默认 http://127.0.0.1:8080；可在 .env.local 设置 API_PROXY_TARGET。前端只访问 /api/v1，服务密钥不能放在 VITE_* 或前端文件中。

JWT 仅保存在内存，刷新需重新登录；菜单和按钮按当前 IAM 菜单权限显示。后端每次独立鉴权，页面显示不等于实际授权。不存在单独的管理员任命或等级检查。

忘记密码、首次使用员工账号，由有权限的管理者在用户管理中重置。临时账号创建时设置密码。密码操作使用统一密码规则，并通过会话版本使已有登录凭证失效。

```powershell
npm test
npm run build
npm run format:check
```

测试使用本机 Chrome 与 5175 端口，在 Playwright 内拦截请求测试界面契约，不作为真实数据库验收。正式开发不提供模拟 API，也不会在后端失败时回退假数据。

src/api.js 管理会话和请求，src/views 是业务页面，src/components 为表格和编辑对话框。后端运行和全量初始化见 [后端说明](https://github.com/Ye331/WhatNameBackend/blob/refactor/simplify/README.md)。
