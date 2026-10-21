// 最多同时执行四项任务，调用方负责检查过期结果和处理单项错误。
export async function forEachConcurrent(items, action, isCurrent = () => true) {
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (cursor < items.length && isCurrent()) {
      const index = cursor++
      await action(items[index], index)
    }
  }))
}
