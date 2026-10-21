// 构建标识变化时，仅重置指定人员及其调岗记录。
export function resetDemoTransfers(storage, buildId, seedUsers, seedChanges) {
  if (storage.getItem('access-demo-build') === buildId) return
  const read = (key, fallback) => {
    try { return JSON.parse(storage.getItem(key)) || fallback } catch { return fallback }
  }
  const extraUsers = [
    { id:'DEMO-U2', name:'林可欣', account:'demo_lkx', employee:'DEMO002', phone:'138****0102', dept:'信息技术部', source:'HR', personType:'正式', status:'可用', color:'blue', roles:['运维工程师'], roleGrants:[{id:'DEMO-G2',role:'运维工程师',basisType:'部门',basisId:'demo-it',department:'信息技术部',status:'有效'}] },
    { id:'DEMO-U3', name:'周文博', account:'demo_zwb', employee:'DEMO003', phone:'138****0103', dept:'财务部', source:'HR', personType:'正式', status:'可用', color:'orange', roles:['财务专员','普通员工'], roleGrants:[{id:'DEMO-G3',role:'财务专员',basisType:'部门',basisId:'demo-finance',department:'财务部',status:'有效'},{id:'DEMO-G4',role:'普通员工',basisType:'工单',basisId:'DEMO-KEEP-001',status:'有效'}] },
  ]
  const demoUsers = [structuredClone(seedUsers.find(u=>u.id==='U004')), ...extraUsers]
  const demoChanges = [
    {id:1,userId:'U004',name:'王雨晴',from:'运营管理部',to:'财务部',type:'岗位调动',state:'待回收旧权限'},
    {id:'DEMO-T2',userId:'DEMO-U2',name:'林可欣',from:'信息技术部',to:'人力资源部',type:'岗位调动',state:'待回收旧权限'},
    {id:'DEMO-T3',userId:'DEMO-U3',name:'周文博',from:'财务部',to:'运营管理部',type:'岗位调动',state:'待回收旧权限'},
  ]
  const users = read('access-users',seedUsers).filter(u=>!demoUsers.some(d=>d.id===u.id))
  const events = read('access-changes',seedChanges).filter(e=>!demoChanges.some(d=>d.id===e.id))
  storage.setItem('access-users',JSON.stringify([...users,...demoUsers]))
  storage.setItem('access-changes',JSON.stringify([...demoChanges,...events]))
  storage.setItem('access-demo-build',buildId)
}
