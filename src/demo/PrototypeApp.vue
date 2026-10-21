<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { resetDemoTransfers } from './demoTransfers.js'
import { normalizeUser, isManualAccount, effectiveRoles, updateRoleAuthorization, applyHrTransfer, createTemporaryAccount } from './accountRules.js'
import { ShieldCheck, LayoutDashboard, Users, KeyRound, Blocks, UserCheck, ArrowLeftRight, ScrollText, Search, Bell, ChevronRight, Plus, X, Check, Download, ArrowRight, LockKeyhole, CheckCircle2, CircleHelp, LogOut, Menu, Building2 } from 'lucide-vue-next'

const nav = [ ['overview','工作台',LayoutDashboard], ['users','用户账号',Users], ['roles','角色管理',KeyRound], ['resources','应用管理',Blocks], ['grants','权限分配',UserCheck], ['changes','人员与组织变动',ArrowLeftRight], ['logs','操作日志',ScrollText] ]
const signedIn = ref(sessionStorage.getItem('access-session') !== 'signed-out')
const page = ref('overview'), query = ref(''), department = ref('全部部门'), status = ref('全部状态'), selected = ref([]), mobileNav = ref(false), toast = ref(''), dialog = ref(null), noticeOpen = ref(false)
const seedUsers = [
{id:'U001',name:'陈思远',account:'csy',employee:'HQ00128',phone:'138****6028',dept:'信息技术部',type:'正式员工',status:'可用',roles:['系统管理员','普通员工'],color:'green'},
{id:'U002',name:'林晓',account:'lx',employee:'HQ00216',phone:'139****1836',dept:'人力资源部',type:'正式员工',status:'可用',roles:['人事专员','普通员工'],color:'blue'},
{id:'U003',name:'张明',account:'zm',employee:'HQ00305',phone:'137****8921',dept:'财务部',type:'正式员工',status:'可用',roles:['财务专员','普通员工'],color:'orange'},
{id:'U004',name:'王雨晴',account:'wyq',employee:'HQ00412',phone:'136****3056',dept:'运营管理部',type:'正式员工',status:'暂停',roles:['普通员工'],roleGrants:[{id:'G004-old',role:'普通员工',basisType:'部门',basisId:'operations',department:'运营管理部',status:'有效'},{id:'G004-group',role:'普通员工',basisType:'任职',basisId:'group-employee',status:'有效'}],color:'purple'},
{id:'U005',name:'刘浩',account:'lh',employee:'HQ00537',phone:'135****7612',dept:'信息技术部',type:'外包员工',status:'可用',roles:['运维工程师'],color:'blue'},
{id:'U006',name:'赵佳',account:'zj',employee:'HQ00623',phone:'158****4290',dept:'人力资源部',type:'正式员工',status:'离职',roles:[],color:'pink'},
{id:'U007',name:'周子墨',account:'zzm',employee:'HQ00681',phone:'159****7201',dept:'运营管理部',type:'正式员工',status:'可用',roles:['普通员工'],color:'green'},
{id:'U008',name:'许文',account:'xw',employee:'',source:'手动',purpose:'短期系统维护',phone:'186****3368',dept:'信息技术部',type:'临时账号',status:'可用',roles:['运维工程师'],color:'orange'}
]
const seedRoles = [{name:'普通员工',desc:'集团员工通用权限，包含考勤与日常办公',menus:['考勤打卡','请假申请','通知公告'],scope:'全集团'}, {name:'系统管理员',desc:'统一权限平台的日常维护与资源管理',menus:['用户账号','角色管理','权限分配','操作日志'],scope:'信息技术部'}, {name:'人事专员',desc:'人员信息查询及组织数据访问',menus:['通讯录','考勤打卡','通知公告'],scope:'人力资源部'}, {name:'财务专员',desc:'财务报销审核和日常办公',menus:['报销管理','请假申请','通知公告'],scope:'财务部'}, {name:'运维工程师',desc:'业务应用运行维护和日志查询',menus:['操作日志','通知公告'],scope:'信息技术部'}]
const seedApps = [{name:'OA 协同办公',code:'OA',color:'orange',desc:'高效协作，让办公更简单',menus:[{name:'请假申请',apis:['GET /oa/leave','POST /oa/leave']},{name:'报销管理',apis:['GET /oa/expense','POST /oa/expense']},{name:'通知公告',apis:['GET /oa/notices']},{name:'通讯录',apis:['GET /oa/contacts']}]},{name:'考勤管理系统',code:'AT',color:'blue',desc:'统一考勤，连接每一位员工',menus:[{name:'考勤打卡',apis:['POST /attendance/check-in','GET /attendance/today']},{name:'考勤记录',apis:['GET /attendance/records']},{name:'考勤报表',apis:['GET /attendance/report']}]},{name:'统一权限管理',code:'UP',color:'green',desc:'自举管理，守护集团数字边界',menus:[{name:'用户账号',apis:['GET /users','PATCH /users/:id']},{name:'角色管理',apis:['GET /roles','POST /roles']},{name:'权限分配',apis:['POST /grants','DELETE /grants']},{name:'操作日志',apis:['GET /audit-logs']}]}]
function stored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback } catch { return fallback } }
const seedChanges = [{id:1,name:'王雨晴',from:'运营管理部',to:'财务部',type:'岗位调动',state:'待回收旧权限'},{id:2,name:'赵佳',from:'人力资源部',to:'—',type:'员工离职',state:'已处理'}]
resetDemoTransfers(localStorage,__DEMO_BUILD_ID__,seedUsers,seedChanges)
const users = ref(stored('access-users',seedUsers).map(normalizeUser)), roles = ref(stored('access-roles',seedRoles)), apps = ref(stored('access-apps',seedApps))
const logs = ref(stored('access-logs',[{id:'AUD1006',actor:'陈思远',action:'批量分配角色',target:'运营管理部 · 12 位员工',time:'2026-10-10 10:42:18',result:'成功'}, {id:'AUD1005',actor:'HR 服务',action:'同步员工账号',target:'周子墨 · HQ00681',time:'2026-10-10 10:30:06',result:'成功'}, {id:'AUD1004',actor:'陈思远',action:'更新菜单资源',target:'OA 协同办公 · 请假申请',time:'2026-10-10 09:56:32',result:'成功'}, {id:'AUD1003',actor:'陈思远',action:'回收离职权限',target:'赵佳 · 人力资源部',time:'2026-10-10 09:18:45',result:'成功'}]))
const changes = ref(stored('access-changes',seedChanges))
const frozen = ref(stored('access-frozen',[]))
for (const [key,value] of [['users',users],['roles',roles],['apps',apps],['logs',logs],['changes',changes],['frozen',frozen]]) watch(value,v=>localStorage.setItem('access-'+key,JSON.stringify(v)),{deep:true})
watch(page,()=>{query.value='';selected.value=[];mobileNav.value=false;transferBasisIds.value=[]})
const title = computed(()=>nav.find(n=>n[0]===page.value)?.[1] || '工作台')
const filtered = computed(()=>users.value.filter(u=>(page.value!=='grants'||administrator.value.departments.includes(u.dept))&&(!query.value || [u.name,u.account,u.employee].some(x=>String(x||'').toLowerCase().includes(query.value.toLowerCase())))&&(department.value==='全部部门'||u.dept===department.value)&&(status.value==='全部状态'||u.status===status.value)))
const depts = ['信息技术部','人力资源部','财务部','运营管理部']
const allMenus = computed(()=>[...new Set(apps.value.flatMap(a=>a.menus.map(m=>m.name)))])
const activeApp = ref('OA'), activeResource = computed(()=>apps.value.find(a=>a.code===activeApp.value)||apps.value[0])
const changeTab = ref('people')
// 管理员上下文用于确定可操作的部门范围。
const administrator = ref(stored('access-administrator', { id:'admin-csy', departments:depts, grantableRoles:['普通员工','系统管理员','人事专员','财务专员','运维工程师'] }))
const grantableRoles = computed(()=>roles.value.filter(r=>administrator.value.grantableRoles.includes(r.name)))
const roleChoice = ref('普通员工'), transferBasisIds = ref([]), form = ref({})
const grantMode = ref('grant'), grantSource = ref('manual'), businessRef = ref(''), grantReason = ref(''), revokeIds = ref([]), grantResults = ref([])
const grantContextId = ref(null)
watch(selected, ids=>{const event=changes.value.find(e=>e.id===grantContextId.value);if(event&&(ids.length!==1||ids[0]!==event.userId))grantContextId.value=null},{deep:true,flush:'sync'})
const availableTransferBases = computed(()=>changes.value.filter(c=>c.type==='岗位调动'&&c.processed&&c.state!=='已处理'&&administrator.value.departments.includes(c.to)&&selected.value.includes(c.userId)))
const revocableBases = computed(()=>users.value.filter(u=>selected.value.includes(u.id)).flatMap(u=>u.roleGrants.filter(g=>g.role===roleChoice.value&&g.status==='有效').map(g=>({...g,userId:u.id,userName:u.name,retained:u.roleGrants.filter(other=>other.role===g.role&&other.status==='有效').length}))))
watch([selected,roleChoice,grantMode],()=>{revokeIds.value=[]},{deep:true,flush:'sync'})
watch([roleChoice,grantMode,grantSource,page],()=>{grantResults.value=[]})
function authorizationSnapshot(targets) { return JSON.stringify(targets.map(u=>({id:u.id,dept:u.dept,status:u.status,grants:u.roleGrants}))) }
const transferBases = computed(()=>changes.value.filter(c=>transferBasisIds.value.includes(c.id)))
watch(selected,ids=>{transferBasisIds.value=transferBasisIds.value.filter(id=>changes.value.some(c=>c.id===id&&ids.includes(c.userId)))},{deep:true})
watch(grantableRoles, list=>{if(!list.some(r=>r.name===roleChoice.value))roleChoice.value=list[0]?.name||''},{immediate:true})
function tell(message) { toast.value=message; setTimeout(()=>toast.value='',3500) }
function audit(action,target,result='成功',actor='陈思远') { logs.value.unshift({id:'AUD'+Date.now(),actor,action,target,time:new Date().toLocaleString('sv-SE'),result}) }
function go(p) { grantContextId.value=null;page.value=p }
function open(kind,data={}) { form.value={name:'',account:'',purpose:'',phone:'',dept:depts[0],desc:'',scope:'全集团',menus:[],...JSON.parse(JSON.stringify(data))};dialog.value=kind }
function logout() {
 audit('退出账号','陈思远')
 signedIn.value=false;sessionStorage.setItem('access-session','signed-out')
 dialog.value=null;noticeOpen.value=false;mobileNav.value=false;selected.value=[];form.value={};query.value='';department.value='全部部门';status.value='全部状态';page.value='overview';toast.value=''
}
function enterConsole() {sessionStorage.removeItem('access-session');signedIn.value=true}
async function save() {
 if(!form.value.name?.trim()) return tell('请填写名称')
 if(dialog.value==='user') {
 if(!/^1\d{10}$/.test(form.value.phone)) return tell('请输入有效的 11 位手机号')
 if(!form.value.purpose?.trim())return tell('请填写用途')
 try { const user=await createTemporaryAccount(form.value,users.value);users.value.push(user);audit('创建临时账号',user.name) } catch(error){return tell(error.message)}
 } else if(dialog.value==='role') {
 if(roles.value.some(r=>r.name===form.value.name&&r.name!==form.value.original))return tell('角色名称已存在')
 const item={name:form.value.name,desc:form.value.desc,scope:form.value.scope,menus:form.value.menus}
 const i=roles.value.findIndex(r=>r.name===form.value.original)
 if(i>=0){roles.value[i]=item;users.value.forEach(u=>{u.roleGrants.forEach(g=>{if(g.role===form.value.original)g.role=item.name});u.roles=effectiveRoles(u)})}else roles.value.push(item)
 audit('保存角色',item.name)
 } else if(dialog.value==='resource') {
 if(!form.value.apis?.trim())return tell('至少绑定一个 API')
 const apis=form.value.apis.split('\n').map(x=>x.trim()).filter(Boolean)
 if(apis.some(x=>!/^(GET|POST|PUT|PATCH|DELETE) \/\S+$/.test(x)))return tell('API 格式示例：GET /oa/leave')
 if(activeResource.value.menus.some(m=>m.name===form.value.name&&m.name!==form.value.original)) return tell('菜单名称已存在')
 const i=activeResource.value.menus.findIndex(m=>m.name===form.value.original)
 const item={name:form.value.name,apis};if(i>=0){activeResource.value.menus[i]=item;roles.value.forEach(r=>r.menus=r.menus.map(n=>n===form.value.original?item.name:n))}else activeResource.value.menus.push(item)
 audit('更新菜单资源',activeResource.value.name+' · '+item.name)
 }
 dialog.value=null;tell('已保存，演示数据已更新')
}
function toggleUser(u) { if(!isManualAccount(u)||u.status==='离职')return;open('confirm',{name:u.name,userId:u.id,action:u.status==='可用'?'暂停账号':'恢复账号',message:u.status==='可用'?'暂停后该账号将不能登录或访问任何业务 API。':'恢复后该账号可以使用已分配的角色权限。'}) }
function confirm() { const f=form.value;if(f.userId){const u=users.value.find(u=>u.id===f.userId);if(!isManualAccount(u)||u.status==='离职')return tell('HR 同步账号的状态由 HR 事件更新');u.status=u.status==='可用'?'暂停':'可用'}else if(f.deptFreeze){if(frozen.value.includes(f.deptFreeze))frozen.value=frozen.value.filter(d=>d!==f.deptFreeze);else frozen.value.push(f.deptFreeze)} audit(f.action,f.name);dialog.value=null;tell('操作完成') }
function selectAll(e) { selected.value=e.target.checked?filtered.value.map(u=>u.id):[] }
function applyGrant() {
 const targets=users.value.filter(u=>selected.value.includes(u.id));if(!targets.length)return tell('请先选择用户')
 if(targets.some(u=>u.status==='离职'))return tell('离职账号不能参与权限分配，请取消选择')
 if(!grantableRoles.value.some(r=>r.name===roleChoice.value))return tell('该角色不在当前管理员可授权角色清单中')
 if(targets.some(u=>!administrator.value.departments.includes(u.dept)))return tell('目标用户超出当前管理员管理范围')
 if(changes.value.some(c=>c.type==='岗位调动'&&!c.processed&&targets.some(u=>u.id===c.userId||u.name===c.name)))return tell('旧岗位权限尚未完成处理，请稍后重试')
 if(!grantReason.value.trim())return tell(grantMode.value==='grant'?'请填写授权理由':'请填写回收理由')
 if(grantMode.value==='revoke') {
  const bases=revocableBases.value
  if(targets.some(u=>!bases.some(g=>g.userId===u.id)))return tell('部分所选用户未持有该角色，请取消选择')
  const request={mode:'revoke',role:roleChoice.value,targets:targets.map(u=>u.id),snapshot:authorizationSnapshot(targets),reason:grantReason.value.trim(),candidates:bases}
  const automaticIds=bases.filter(g=>bases.filter(other=>other.userId===g.userId).length===1).map(g=>g.id)
  if(automaticIds.length===targets.length){openRevokeConfirmation({...request,basisIds:automaticIds});return}
  open('revoke-basis',{...request,basisIds:automaticIds});return
 }
 const request={mode:'grant',role:roleChoice.value,targets:targets.map(u=>u.id),snapshot:authorizationSnapshot(targets),reason:grantReason.value.trim()}
 if(grantContextId.value!==null){
  const event=availableTransferBases.value.find(e=>e.id===grantContextId.value)
  if(!event||targets.length!==1||targets[0].id!==event.userId||targets[0].dept!==event.to)return tell('调岗上下文已失效，请从人员变动记录重新进入')
  open('grant-confirm',{...request,eventIds:[event.id],sourceLabel:'人员调岗',sourceRef:'HR-'+event.id});return
 }
 open('manual-grant',{...request,sourceRef:''})
}
function confirmManualGrant(){
 if(!form.value.sourceRef?.trim())return tell('请填写真实的业务依据编号')
 open('grant-confirm',{...form.value,sourceRef:form.value.sourceRef.trim(),sourceLabel:'手工授权'})
}
function openRevokeConfirmation(request){
 const targets=users.value.filter(u=>request.targets.includes(u.id))
 if(authorizationSnapshot(targets)!==request.snapshot)return tell('授权记录已变化，请关闭弹窗重新确认')
 const bases=request.candidates.filter(g=>request.basisIds.includes(g.id))
 if(!bases.length||bases.length!==request.basisIds.length)return tell('请选择有效的回收依据')
 if(targets.some(u=>!bases.some(g=>g.userId===u.id)))return tell('请为每位所选用户选择回收依据')
 open('grant-confirm',{...request,summary:targets.map(u=>({name:u.name,basis:bases.filter(g=>g.userId===u.id).map(g=>g.basisType+' · '+g.basisId).join('、'),remaining:request.candidates.filter(g=>g.userId===u.id&&!request.basisIds.includes(g.id)).length}))})
}
function confirmGrantOperation(){
 const f=form.value, targets=users.value.filter(u=>f.targets.includes(u.id))
 if(targets.length!==f.targets.length||targets.some(u=>u.status==='离职'||!administrator.value.departments.includes(u.dept))||!grantableRoles.value.some(r=>r.name===f.role))return tell('用户或授权资格已变化，请重新选择')
 if(authorizationSnapshot(targets)!==f.snapshot)return tell('授权记录已变化，请关闭弹窗重新确认')
 if(changes.value.some(c=>c.type==='岗位调动'&&!c.processed&&targets.some(u=>u.id===c.userId||u.name===c.name)))return tell('旧岗位权限尚未完成处理，请稍后重试')
 const events=f.eventIds?changes.value.filter(e=>f.eventIds.includes(e.id)):[]
 if(f.eventIds&&(events.length!==f.eventIds.length||events.some(e=>!e.processed||e.authorizationCompleted||!targets.some(u=>u.id===e.userId&&u.dept===e.to))||(!f.sourceRef&&targets.some(u=>!events.some(e=>e.userId===u.id)))))return tell('调岗记录已变化，请重新选择')
 if(f.mode==='revoke'&&f.basisIds.some(id=>!targets.some(u=>u.roleGrants.some(g=>g.id===id&&g.role===f.role&&g.status==='有效'))))return tell('授权依据已变化，请重新选择')
 const results=[]
 for(const user of targets){
  const ids=f.mode==='revoke'?user.roleGrants.filter(g=>f.basisIds.includes(g.id)).map(g=>g.id):[]
  const userEvents=events.filter(e=>e.userId===user.id)
  if(userEvents.length)for(const event of userEvents){
   updateRoleAuthorization(user,{role:f.role,mode:'grant',sourceType:'人员调职',businessBasis:'HR-'+event.id,actor:administrator.value.id,reason:f.reason,department:event.to})
   event.authorizationCompleted=true;event.state='已处理';event.authorizationBasis={type:'人员调职',id:'HR-'+event.id}
  }
  else updateRoleAuthorization(user,{role:f.role,mode:f.mode,sourceType:'手工授权',businessBasis:f.sourceRef,actor:administrator.value.id,basisIds:ids,reason:f.reason,revocationBasis:f.reason})
  results.push({id:user.id,name:user.name,role:f.role,message:f.mode==='grant'?'授权依据已登记':user.roles.includes(f.role)?'已回收所选依据，其他依据仍使角色有效':'所选依据已回收，角色已失效'})
  audit(f.mode==='grant'?'授予角色':'按依据回收角色',user.name+' · '+f.role+' · '+(userEvents.length?userEvents.map(e=>'HR-'+e.id).join('、'):f.sourceRef||ids.join('、'))+' · '+f.reason)
 }
 selected.value=[];grantResults.value=results;dialog.value=null;businessRef.value='';grantReason.value='';tell('已完成 '+results.length+' 位用户的权限操作')
 grantContextId.value=null
}
function processHrEvents() {
 for(const event of changes.value){
  if(event.type!=='岗位调动'||event.processed)continue
  const user=users.value.find(u=>u.id===event.userId||u.name===event.name)
  if(!user||user.source!=='HR')continue
  const result=applyHrTransfer(user,event)
  if(result){audit('HR 自动回收旧授权依据',event.name+' · '+result.revoked.length+' 条依据','成功','HR 服务');audit('HR 自动更新部门归属',event.name+' · '+event.to,'成功','HR 服务')}
 }
 for(const event of changes.value){
  if(event.type!=='岗位调动')continue
  delete event.recoveryConfirmed;delete event.handoverConfirmed;delete event.handoverResult
  event.state=event.authorizationCompleted?'已处理':event.processed?'待新部门授权':'待回收旧权限'
 }
 for(const [key,value] of [['users',users],['changes',changes],['logs',logs]])localStorage.setItem('access-'+key,JSON.stringify(value.value))
}
processHrEvents()
function showChangeResult(event){
 if(!administrator.value.departments.includes(event.from)&&!administrator.value.departments.includes(event.to))return tell('该记录不属于当前管理范围')
 if(!event.processed)return tell('旧岗位授权依据尚未完成处理，请稍后重试')
 open('change-result',{...event})
}
const visibleChanges = computed(()=>changes.value.filter(c=>administrator.value.departments.includes(c.from)||(c.type==='岗位调动'&&c.processed&&administrator.value.departments.includes(c.to))))
const pendingChanges = computed(()=>visibleChanges.value.filter(c=>c.state!=='已处理'&&administrator.value.departments.includes(c.type==='岗位调动'&&c.processed?c.to:c.from)))
async function grantTransferredUser(event){
 if(!event.processed||event.state==='已处理'||!administrator.value.departments.includes(event.to))return
 const user=users.value.find(u=>u.id===event.userId)
 if(!user)return tell('未找到调岗员工')
 go('grants');await nextTick();grantMode.value='grant';grantSource.value='transfer';grantReason.value='';department.value=event.to;status.value='全部状态';selected.value=[user.id];transferBasisIds.value=[];grantContextId.value=event.id
}
function chooseAuthorizationBasis(){
 if(!selected.value.length)return tell('请先选择员工')
 open('authorization-basis',{basisIds:[...transferBasisIds.value]})
}
function confirmAuthorizationBasis(){
 const events=availableTransferBases.value.filter(c=>form.value.basisIds.includes(c.id))
 if(!events.length||events.length!==form.value.basisIds.length)return tell('请选择有效的人员变动记录')
 transferBasisIds.value=events.map(c=>c.id);dialog.value=null

}
function exportLogs() { const content='\uFEFF'+['时间,操作人,操作,对象,结果',...logs.value.map(l=>[l.time,l.actor,l.action,l.target,l.result].map(x=>'"'+String(x).replaceAll('"','""')+'"').join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='操作日志.csv';a.click();URL.revokeObjectURL(url);tell('日志已导出') }
</script>

<template>
 <div v-if="!signedIn" class="signed-out"><section><ShieldCheck :size="35"/><h1>已退出账号</h1><p>当前登录状态已清除。</p><button class="button primary" @click="enterConsole">重新进入管理后台</button></section></div>
 <div v-else class="shell">
  <aside :class="['sidebar',{shown:mobileNav}]">
   <a class="brand" href="#" @click.prevent="go('overview')"><span class="brand-icon"><ShieldCheck :size="25"/></span><span>统一权限管理<small>ACCESS HUB</small></span></a>
   <div class="workspace"><span class="workspace-icon"><Building2 :size="18"/></span><div>集团管理空间<small>总公司 · 全集团数据范围</small></div></div>
   <div class="nav-label">管理控制台</div>
   <nav><button v-for="[id,label,icon] in nav" :key="id" :aria-label="label" :class="{active:page===id}" @click="go(id)"><component :is="icon" :size="19"/><span>{{label}}</span><span v-if="id==='changes'" class="nav-count">{{pendingChanges.length}}</span></button></nav>
   <div class="sidebar-bottom"><button class="profile" @click="open('profile',{name:'陈思远'})"><span class="avatar admin">陈</span><span>陈思远<small>总公司管理员</small></span><ChevronRight :size="16"/></button></div>
  </aside>
  <div class="body">
   <header><button class="icon-button mobile-menu" @click="mobileNav=!mobileNav" aria-label="展开导航"><Menu :size="20"/></button><div class="breadcrumb">管理控制台 <ChevronRight :size="13"/><strong>{{title}}</strong></div><div class="header-right"><button class="icon-button" @click="open('help',{name:'使用帮助'})" aria-label="帮助"><CircleHelp :size="20"/></button><div class="notification"><button class="icon-button bell" @click="noticeOpen=!noticeOpen" aria-label="通知"><Bell :size="20"/><i></i></button><div v-if="noticeOpen" class="notice-panel"><strong>待处理提醒</strong><p>{{pendingChanges.length}} 条人员变动需要处理</p><button class="text-button" @click="go('changes');noticeOpen=false">查看人员变动 <ArrowRight :size="14"/></button></div></div><span class="header-divider"></span><button class="header-avatar" aria-label="管理员头像" @click="open('profile',{name:'陈思远'})">陈</button></div></header>
   <main>
    <div class="page-heading"><div><h1>{{page==='overview'?'工作台':title}}</h1><p>{{({overview:'你好，陈思远。',users:'管理账号与账号状态',roles:'按岗位配置菜单权限',resources:'选择应用，维护菜单权限',grants:'选择用户，批量授予或回收角色',changes:'处理人员变动与部门权限',logs:'查询权限变更记录'})[page]}}</p></div><div class="heading-actions"><button v-if="page==='users'" class="button primary" @click="open('user')"><Plus :size="16"/>新建临时账号</button><button v-if="page==='roles'" class="button primary" @click="open('role')"><Plus :size="16"/>新建角色</button><button v-if="page==='logs'" class="button light" @click="exportLogs"><Download :size="16"/>导出日志</button></div></div>

    <template v-if="page==='overview'">
     <div class="simple-stats"><button v-for="s in [{label:'用户账号',value:users.length,icon:Users,page:'users'},{label:'角色',value:roles.length,icon:KeyRound,page:'roles'},{label:'接入应用',value:apps.length,icon:Blocks,page:'resources'}]" :key="s.page" @click="go(s.page)"><div><span>{{s.label}}</span><strong>{{s.value}}</strong></div><component :is="s.icon" :size="23" :stroke-width="1.5"/></button></div>
     <section class="panel simple-tasks"><div class="panel-heading"><h3>待处理事项 <span class="count-badge">{{pendingChanges.length}}</span></h3></div><div class="simple-task" v-for="c in pendingChanges" :key="c.id"><span class="icon-tile neutral"><ArrowLeftRight :size="18"/></span><div><strong>{{c.name}} · {{c.type}}</strong><p>{{c.from}} → {{c.to}}</p></div><span class="tag orange">{{c.state}}</span><button class="text-button" @click="go('changes')">去处理 <ChevronRight :size="14"/></button></div><div v-if="!pendingChanges.length" class="empty">所有事项已处理</div></section>
    </template>

    <template v-if="page==='users'||page==='grants'">
     <div v-if="page==='grants'" class="grant-bar panel compact-grants"><div><h3>批量角色操作</h3><p>已选 {{selected.length}} 位员工，授权按角色叠加</p></div><select v-model="grantMode" aria-label="权限操作"><option value="grant">授予角色</option><option value="revoke">回收角色</option></select><select v-model="roleChoice" aria-label="操作角色"><option v-for="r in grantableRoles" :key="r.name">{{r.name}}</option></select><input v-model="grantReason" :aria-label="grantMode==='grant'?'授权理由':'回收理由'" :placeholder="grantMode==='grant'?'填写授权理由（必填）':'填写回收理由（必填）'" maxlength="300" required/><button class="button primary" @click="applyGrant"><Check :size="16"/>{{grantMode==='grant'?'确认授权':'确认回收'}}</button></div>
     <section v-if="page==='grants'&&grantResults.length" class="panel grant-results" aria-label="权限操作结果"><h3>执行结果 · {{grantResults.length}} 位用户</h3><p v-for="r in grantResults" :key="r.id">{{r.name}} · {{r.role}} · {{r.message}}</p></section>
     <section class="panel table-panel"><div class="table-toolbar"><div class="search-field"><Search :size="17"/><input v-model="query" placeholder="搜索姓名、账号或工号" aria-label="搜索用户"/></div><select v-model="department" aria-label="筛选部门"><option>全部部门</option><option v-for="d in depts" :key="d">{{d}}</option></select><select v-model="status" aria-label="筛选状态"><option>全部状态</option><option>可用</option><option>暂停</option><option>离职</option></select><span class="toolbar-summary">共 {{filtered.length}} 个账号</span></div><div class="table-scroll"><table><thead><tr><th v-if="page==='grants'"><input type="checkbox" :checked="!!filtered.length&&filtered.every(u=>selected.includes(u.id))" @change="selectAll" aria-label="全选用户"/></th><th>用户</th><th>账号 / 工号</th><th>所属部门</th><th>来源</th><th v-if="page==='grants'">角色</th><th>状态</th><th v-if="page==='users'">操作</th></tr></thead><tbody><tr v-for="u in filtered" :key="u.id"><td v-if="page==='grants'"><input type="checkbox" v-model="selected" :value="u.id" :aria-label="'选择'+u.name"/></td><td><div class="user-cell"><span :class="['avatar',u.color]">{{u.name.slice(-2)}}</span><div><strong>{{u.name}}</strong></div></div></td><td>{{u.account}}<small class="cell-secondary">{{u.employee}}</small></td><td>{{u.dept}}<small v-if="frozen.includes(u.dept)" class="red-text">部门已冻结</small></td><td><span :class="['tag',u.source==='手动'?'orange':'neutral']">{{u.source==='手动'?'临时':u.personType}}</span></td><td v-if="page==='grants'"><span v-for="r in u.roles" :key="r" class="role-tag">{{r}}</span><span v-if="!u.roles.length" class="muted">未分配</span></td><td><span :class="['tag',u.status==='可用'?'green':u.status==='暂停'?'orange':'neutral']"><i></i>{{u.status}}</span></td><td v-if="page==='users'"><button class="text-button" @click="open('detail',u)">详情</button><button v-if="isManualAccount(u)&&u.status!=='离职'" class="text-button secondary-action" @click="toggleUser(u)">{{u.status==='可用'?'暂停':'恢复'}}</button></td></tr><tr v-if="!filtered.length"><td colspan="8" class="empty">没有找到符合条件的账号</td></tr></tbody></table></div><div class="table-footer"><span>显示 {{filtered.length?1:0}}–{{filtered.length}} 条，共 {{filtered.length}} 条</span><span class="page-number">1</span></div></section>
    </template>

    <template v-if="page==='roles'"><section class="panel"><div class="table-scroll"><table><thead><tr><th>角色名称</th><th>适用范围</th><th>用户数</th><th>菜单权限</th><th>操作</th></tr></thead><tbody><tr v-for="r in roles" :key="r.name"><td><strong>{{r.name}}</strong></td><td>{{r.scope}}</td><td>{{users.filter(u=>u.roles.includes(r.name)).length}}</td><td>{{r.menus.length}} 项</td><td><button class="text-button" @click="open('role',{...r,original:r.name})">配置权限</button></td></tr></tbody></table></div></section></template>

    <template v-if="page==='resources'"><div class="resource-layout"><section class="panel app-selector"><div class="panel-heading"><h3>业务应用 <span class="count-badge">{{apps.length}}</span></h3></div><button v-for="a in apps" :key="a.code" :class="{chosen:activeApp===a.code}" @click="activeApp=a.code"><span :class="['app-logo',a.color]">{{a.code}}</span><div><strong>{{a.name}}</strong><small>{{a.menus.length}} 项菜单权限</small></div><ChevronRight :size="16"/></button></section><section class="panel"><div class="panel-heading resource-heading"><div><h3>{{activeResource.name}}</h3><p>{{activeResource.desc}}</p></div><button class="button primary" @click="open('resource',{apis:''})"><Plus :size="16"/>添加菜单</button></div><div class="resource-item" v-for="m in activeResource.menus" :key="m.name"><div class="resource-title"><span class="icon-tile neutral"><Menu :size="18"/></span><strong>{{m.name}}</strong><span class="tag neutral">{{m.apis.length}} 个 API</span><button class="text-button" @click="open('resource',{...m,original:m.name,apis:m.apis.join('\n')})">编辑映射</button></div><details class="api-details"><summary>查看 API</summary><div class="api-list"><code v-for="api in m.apis" :key="api"><span :class="{post:!api.startsWith('GET')}">{{api.split(' ')[0]}}</span>{{api.split(' ')[1]}}</code></div></details></div></section></div></template>

    <template v-if="page==='changes'"><div class="page-tabs" role="tablist" aria-label="变动管理"><button role="tab" :aria-selected="changeTab==='people'" :class="{selected:changeTab==='people'}" @click="changeTab='people'">人员变动</button><button role="tab" :aria-selected="changeTab==='departments'" :class="{selected:changeTab==='departments'}" @click="changeTab='departments'">部门冻结</button></div><section v-if="changeTab==='people'" class="panel"><div class="panel-heading"><h3>人员变动记录</h3><span class="tag neutral">HR 同步</span></div><div class="table-scroll"><table><thead><tr><th>员工</th><th>变动类型</th><th>原部门</th><th>新部门</th><th>处理状态</th><th>操作</th></tr></thead><tbody><tr v-for="c in visibleChanges" :key="c.id"><td><strong>{{c.name}}</strong></td><td>{{c.type}}</td><td>{{c.from}}</td><td>{{c.to}}</td><td><span :class="['tag',c.state==='已处理'?'green':'orange']">{{c.state}}</span></td><td><div class="change-actions"><template v-if="c.type==='岗位调动'"><span v-if="c.state==='已处理'" class="muted">已完成</span><button v-if="c.processed" class="text-button" @click="showChangeResult(c)">查看回收结果</button><button v-if="c.processed&&c.state!=='已处理'&&administrator.departments.includes(c.to)" class="text-button" @click="grantTransferredUser(c)">授予权限</button></template><span v-else class="muted">已完成</span></div></td></tr></tbody></table></div></section><section v-else class="panel department-panel"><div class="panel-heading"><div><h3>部门权限冻结</h3><p>冻结整个部门的访问权限，保留原角色与操作现场。</p></div></div><div class="department-grid"><div v-for="d in depts" :key="d"><span class="icon-tile neutral"><Building2 :size="20"/></span><strong>{{d}}<small>{{users.filter(u=>u.dept===d).length}} 位员工</small></strong><button :class="['button',frozen.includes(d)?'light':'danger-light']" @click="open('confirm',{name:d,deptFreeze:d,action:frozen.includes(d)?'解除部门冻结':'冻结部门权限',message:frozen.includes(d)?'解除后，可用账号将恢复其已分配的角色权限。':'该部门所有员工的 API 访问将被拒绝。原角色记录会保留。'})">{{frozen.includes(d)?'解除冻结':'冻结权限'}}</button></div></div></section></template>

    <template v-if="page==='logs'"><section class="panel table-panel"><div class="table-toolbar"><div class="search-field"><Search :size="17"/><input v-model="query" placeholder="搜索操作、对象或操作人"/></div><span class="toolbar-summary">{{logs.length}} 条记录</span></div><div class="table-scroll"><table><thead><tr><th>操作时间</th><th>操作人</th><th>操作</th><th>操作对象</th><th>结果</th></tr></thead><tbody><tr v-for="l in logs.filter(l=>!query||[l.actor,l.action,l.target].some(x=>x.includes(query)))" :key="l.id"><td class="mono">{{l.time}}</td><td>{{l.actor}}</td><td>{{l.action}}</td><td>{{l.target}}</td><td><span :class="['tag',l.result==='成功'?'green':'orange']">{{l.result}}</span></td></tr></tbody></table></div></section></template>


    <footer><span>统一权限管理 · 前端演示</span></footer>
   </main>
  </div>
  <Transition name="toast"><div v-if="toast" class="toast"><CheckCircle2 :size="18"/>{{toast}}</div></Transition>
  <div v-if="dialog" class="modal-backdrop" @click.self="dialog=null"><section class="modal" role="dialog" aria-modal="true" :aria-label="({user:'新建临时账号',role:'配置角色',resource:'菜单与 API 映射',confirm:form.action,detail:'账号详情',help:'使用帮助',profile:'管理员身份','revoke-basis':'选择回收依据','manual-grant':'补充授权依据','grant-confirm':'确认权限操作','authorization-basis':'选择授权依据','change-result':'自动回收结果'})[dialog]"><div class="modal-heading"><h3>{{({user:'新建临时账号',role:'配置角色',resource:'菜单与 API 映射',confirm:form.action,detail:'账号详情',help:'使用帮助',profile:'管理员身份','revoke-basis':'选择回收依据','manual-grant':'补充授权依据','grant-confirm':'确认权限操作','authorization-basis':'选择授权依据','change-result':'自动回收结果'})[dialog]}}</h3><button class="icon-button" @click="dialog=null" aria-label="关闭"><X :size="20"/></button></div><form v-if="['user','role','resource'].includes(dialog)" @submit.prevent="save"><label>{{dialog==='user'?'姓名':dialog==='role'?'角色名称':'菜单名称'}}<input v-model="form.name" required maxlength="30" placeholder="请输入名称"/></label><template v-if="dialog==='user'"><label>手机号<input v-model="form.phone" required placeholder="请输入 11 位手机号"/></label><label>所属部门<select v-model="form.dept"><option v-for="d in depts" :key="d">{{d}}</option></select></label><label>用途（必填）<textarea v-model="form.purpose" required maxlength="300" rows="3" placeholder="说明本次短期使用用途"></textarea></label><p class="form-note">临时账号无工号，用户名由服务端生成。本人首次通过短信验证设密后方可登录，使用结束后由管理员手动暂停。</p></template><template v-if="dialog==='role'"><label>角色说明<input v-model="form.desc" placeholder="描述该岗位的职责"/></label><label>适用范围<select v-model="form.scope"><option>全集团</option><option v-for="d in depts" :key="d">{{d}}</option></select></label><label>允许访问的菜单</label><div class="checkbox-grid"><label v-for="m in allMenus" :key="m"><input type="checkbox" v-model="form.menus" :value="m"/>{{m}}</label></div></template><template v-if="dialog==='resource'"><label>绑定 API（一行一个）<textarea v-model="form.apis" rows="5" required placeholder="GET /oa/leave&#10;POST /oa/leave"></textarea></label><p class="form-note">每个菜单对应一组 API，授予该菜单即授予对应 API 权限。</p></template><div class="modal-actions"><button class="button light" type="button" @click="dialog=null">取消</button><button class="button primary" type="submit">保存配置</button></div></form><template v-else-if="dialog==='revoke-basis'"><div class="help-content revoke-options"><p>只撤销选中的依据。单条依据已自动定位；多条依据请明确选择。</p><div v-for="userId in form.targets" :key="userId" class="revoke-user"><strong>{{users.find(u=>u.id===userId)?.name}} · {{form.role}}</strong><label v-for="g in form.candidates.filter(g=>g.userId===userId)" :key="g.id" class="authorization-option"><input type="checkbox" v-model="form.basisIds" :value="g.id" :disabled="form.candidates.filter(other=>other.userId===userId).length===1" :aria-label="g.userName+' · '+g.basisId"/><span><strong>{{g.basisType}} · {{g.basisId}}</strong><small>{{g.reason||'历史记录未填写理由'}}{{form.candidates.filter(other=>other.userId===userId).length===1?' · 已自动定位':''}}</small></span></label></div></div><div class="modal-actions"><button class="button light" @click="dialog=null">取消</button><button class="button primary" @click="openRevokeConfirmation(form)">确认选择</button></div></template><form v-else-if="dialog==='manual-grant'" @submit.prevent="confirmManualGrant"><p class="form-note">手工授权 · {{form.targets.length}} 位用户 · {{form.role}}</p><label>业务依据编号<input v-model="form.sourceRef" required maxlength="100" placeholder="填写已核实的业务记录编号"/></label><p class="form-note">授权理由：{{form.reason}}。同一业务依据会分别登记到每位用户，取消不会提交。</p><div class="modal-actions"><button class="button light" type="button" @click="dialog=null">取消</button><button class="button primary" type="submit">继续确认</button></div></form><template v-else-if="dialog==='grant-confirm'"><div class="help-content"><p>将为 {{form.targets.length}} 位用户{{form.mode==='grant'?'授予':'回收'}}「{{form.role}}」。</p><p v-for="userId in form.targets" :key="userId">{{users.find(u=>u.id===userId)?.name}}</p><p v-if="form.mode==='grant'">授权来源：{{form.sourceLabel}} · {{form.sourceRef}}</p><p>操作原因：{{form.reason}}</p><p v-for="(item,i) in form.summary||[]" :key="i">{{item.name}} · {{item.basis}} · {{form.mode==='grant'?'登记新的岗位授权依据':item.remaining?'回收后仍有 '+item.remaining+' 条依据，角色继续有效':'回收后该角色失效'}}</p></div><div class="modal-actions"><button class="button light" @click="dialog=null">取消</button><button class="button primary" @click="confirmGrantOperation">执行操作</button></div></template><template v-else-if="dialog==='authorization-basis'"><div class="help-content"><p>仅显示已选员工对应的人员变动记录，可多选。</p><label v-for="c in availableTransferBases" :key="c.id" class="authorization-option"><input type="checkbox" v-model="form.basisIds" :value="c.id" name="authorization-basis" :aria-label="c.name+' · '+c.from+' → '+c.to"/><span><strong>{{c.name}} · {{c.type}}</strong><small>{{c.from}} → {{c.to}} · {{c.state}}</small></span></label><p v-if="!availableTransferBases.length">暂无符合条件的人员变动记录；非调岗授权请选择手工授权。</p></div><div class="modal-actions"><button class="button light" @click="dialog=null">取消</button><button class="button primary" @click="confirmAuthorizationBasis">确认选择</button></div></template><template v-else-if="dialog==='confirm'"><div class="confirm-content"><span class="icon-tile orange"><LockKeyhole :size="22"/></span><h3>{{form.name}}</h3><p>{{form.message}}</p></div><div class="modal-actions"><button class="button light" @click="dialog=null">取消</button><button class="button primary" @click="confirm">确认{{form.action}}</button></div></template><template v-else-if="dialog==='change-result'"><div class="help-content"><p><strong>{{form.name}}</strong> · HR 调岗事件</p><p>系统先限制旧部门、旧岗位授权依据，再按依据回收；其他合法依据保持有效。</p><p>已回收依据：{{form.recoveryResult?.revoked.map(g=>g.role+'（'+g.basisType+'）').join('、')||'无可回收旧依据'}}</p><p>保留角色：{{form.recoveryResult?.retainedRoles.join('、')||'无'}}</p><p>目标部门：{{form.to}}</p><p>当前阶段：{{form.state}}</p><p>旧权限处理和部门归属更新已自动完成，新岗位角色由新部门管理员授予。</p></div></template><template v-else-if="dialog==='detail'"><div class="detail-profile"><span :class="['avatar',form.color]">{{form.name.slice(-2)}}</span><h3>{{form.name}}</h3><span class="tag neutral">{{form.source==='手动'?'临时':form.personType}}</span></div><div class="setting-row" v-for="[k,v] in [['登录账号',form.account],['员工工号',form.employee||''],['手机号',form.phone],['所属部门',form.dept],['账号状态',form.status],...(form.source==='手动'?[['用途',form.purpose||'待补充'],['密码状态',form.credentialStatus||'未设密']]:[]),['已分配角色',form.roles.join('、')||'未分配']]" :key="k"><span class="muted">{{k}}</span><strong>{{v}}</strong></div></template><template v-else-if="dialog==='help'"><div class="help-content"><p>① 在用户账号中查询 HR 来源员工，或创建外部人员临时账号。</p><p>② 在应用管理中维护菜单及 API 映射，在角色管理中组合菜单权限。</p><p>③ 在权限分配中选择用户、角色及业务依据，填写原因后授予或按依据回收。</p><p>④ 在人员与组织变动中查看人员变动和处理部门冻结，在操作日志中查询与导出操作记录。</p><p class="form-note">当前数据存储于本机浏览器。跨浏览器共享、HR/OA 联动及真正的安全校验需接入后端服务。</p></div></template><template v-else><div class="detail-profile"><span class="avatar admin">陈</span><h3>陈思远</h3><p>总公司管理员 · 全集团管理范围</p></div><div class="modal-actions"><button class="button light logout-button" @click="logout"><LogOut :size="16"/>退出账号</button></div></template></section></div>
 </div>
</template>
