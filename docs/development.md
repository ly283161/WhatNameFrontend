# 开发与第一阶段检查

## 本地运行

```powershell
npm.cmd ci
npm.cmd run dev:mock
```

打开终端显示的地址。检查账号为 `admin`，密码为 `Admin123!`；模拟验证码为 `123456`，仅供开发环境使用。页面顶部始终显示模拟标识。服务重启后恢复来源数据，模拟写入仅保存在开发服务内存。

- `npm.cmd run dev`：连接真实后端，默认通过 Vite 代理访问 `http://127.0.0.1:8080/api/v1`。复制 `.env.example` 为 `.env.local` 可修改代理地址和权限平台应用编码。
- `npm.cmd run dev:demo`：查看原有界面原型。
- `npm.cmd test`：原型回归、正式入口测试和模拟接口端到端测试；使用端口 5174、5175、5176 和本机 Chrome。
- `npm.cmd run build`：生成正式前端。模拟服务、检查账号和来源数据不包含在生产包内。生产环境需将 `/api` 反向代理到真实后端。

JWT 仅保存在内存；刷新后重新登录。真实接口不可用时明确报错，不回退到模拟数据。模拟模式与正式模式均使用同一组管理页面和 Fetch 请求。

## 数据依据

`dev/fixtures.json` 是开发服务实际使用的数据集，来自用户提供的员工信息表、部门信息表和应用软件功能权限清单；不是备份或临时提取文件。保留员工 SG 标识、部门树、应用/模块/功能点及来源权限描述，员工手机号仅保留掩码。原始 xlsx 不复制进项目，不修改或上传。

用于预览的内部 ID、`mock_sg...` 登录名、应用/菜单编码和启用状态是模拟值。员工的“用户名”列为 SG 标识，不能误当作正式登录名。员工部门按“分公司 + 部门”对应部门信息表的完整名称。部门经理姓名不自动作为可靠用户 ID 或管理员任命。

功能清单不提供真实后端路由。来源功能不自动编造 API；界面可登记真实 API 并配置菜单映射。来源权限中的“查看/编辑/审批”等操作粒度，需要后端按实际路由注册后验证。模拟服务只验证前端契约与交互，不替代真实加密、签名、审计、分级权限、HR/OA 认证、性能或数据导入。

## 第一阶段页面检查

| 页面 | 可检查的基础功能 | 接口范围 |
| --- | --- | --- |
| 登录与凭据 | 账号/手机号密码登录、验证码发送、首次设密、重置密码、注销、失效提示 | AU01、AU04、AU05、AU07、AU08 |
| 工作台与账号 | 按管理菜单显示入口、服务端统计、分页搜索、临时账号、详情、有效菜单、暂停恢复 | AU02、US01—US06 |
| 应用管理 | 应用登记维护、目录/菜单、API 登记维护、菜单 API 映射及版本冲突 | RE01—RE11 |
| 角色管理 | 角色定义、启停、角色菜单集合和版本冲突；普通入口不创建超级角色 | RL01—RL06 |
| 权限分配 | 本人可授权角色、单人授予、按依据回收、批量接收与分页结果、授权历史 | AD05、GR01—GR06 |
| 组织管理 | 部门层级、部门及下属人员、冻结/解冻与操作原因 | DP01—DP04 |
| 管理员管理 | 本人范围、管理员任命/撤销、可授权清单及版本 | AD01—AD06 |
| 审计 | 操作/鉴权/登录日志分页、证据详情、当前页 CSV 导出 | LG01—LG04 |

第一阶段依据后端仓库 [DEVELOPMENT_PLAN.md](https://github.com/Ye331/WhatNameBackend/blob/main/DEVELOPMENT_PLAN.md)：按契约和模拟响应完成管理页面与基础接口对接。第二阶段才验证真实跨模块链路。当前不能把模拟自测通过称为真实系统验收。

C 模块已实现的版本字段和批量协议按 [C_STAGE1.md](https://github.com/Ye331/WhatNameBackend/blob/main/docs/C_STAGE1.md) 接入：用户角色/来源查询使用 `grantRevision`，角色菜单使用 `permissionRevision`，映射使用 `mappingVersion`，可授权清单使用 `delegationVersion`。全量替换保留未加载但原本已选的 ID，不擅自丢失既有授权。

批量新建返回 202/PENDING，只表示接收；页面通过任务 ID 分页读取逐项结果，区分完成、部分成功、失败和待处理。同一内容提交失败后保留幂等键，不自动重发写请求。当前 C 模块不支持 `dryRun`、恢复和自动重试，因此页面不提供这些操作。单人回收精确指定来源，其他合法来源保留。

## 需后端补充或联调确认

1. **人员变动查询**：本地 OpenAPI/规范仅定义 HR 事件写入，没有人员变动列表及单条处理结果 GET；后端 main 的组织/审计 Controller 当前仍为目录占位。需要 A 模块给出分页列表、详情/处理结果契约，包含事件 ID、用户 ID、变动类型、原新部门、处理状态、按依据回收结果及失败原因。前端不调用可信 HR 写接口，也不提供“人工完成调岗”。审计查询可以反映已有操作，但不能补造缺失的业务结果。
2. **查询字段**：用户列表/详情需返回 `source`（区分手动与 HR）、`sgNo` 和密码初始化状态，供临时账号维护显示。后端仍须独立核验来源和状态。部门、应用、菜单名称及分页字段按本地候选契约，需要与 A/B/D 实现同步。
3. **范围和菜单**：确认权限平台 `appCode`、菜单编码/路径、动作权限如何下发；当前视图识别 `IAM_*_VIEW`，写按钮识别相应动作编码。真实管理员身份、等级、对象范围、可授权角色和每次写入资格由后端判定。
4. **外部与安全链路**：HR/OA 回调、服务端 `/auth/check`、数字签名、永久审计和实时撤权不在浏览器实现。端到端链路和性能在第二阶段联调。

## 文件与提交

保留源码、自动化测试、开发模拟服务、必要数据集与设计资料。依赖目录不提交；构建和测试输出可再生，检查后清理，不保留一次性修改脚本、备份或审查截图。

提交前先由用户检查确认，再提交并推送至 GitHub。团队协作按任务分支与审查流程进行。

## 登录页视觉资源

登录页参考用户提供的蓝白左右分栏样式，使用灰色输入框、蓝色按钮与斜切装饰。背景照片保存在 `public/login-city.png`，由内置 image_gen 工具生成，仅作界面装饰，不指代真实公司地点。

生成提示词：

> Create a photorealistic architectural cityscape photograph as a website login background asset, portrait 4:5 aspect ratio. A modern Chinese coastal city business district in clear daylight, tall elegant blue glass skyscrapers with varied heights, one slender central tower, some historical red-roof civic buildings in the foreground, bright clean blue sky, sophisticated corporate municipal infrastructure feeling. Camera looking slightly upward from an elevated viewpoint. Crisp natural architectural photography, realistic materials, no people in focus. No text, no labels, no graphics, no diagonal overlay, no UI, no watermark. The image will fill the left 60 percent of a blue and white login screen; compose buildings across the width with sky in the top third.
