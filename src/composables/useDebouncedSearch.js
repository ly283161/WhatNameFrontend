import { watch, onBeforeUnmount } from 'vue'

export function useDebouncedSearch(keyword, load, delay = 350) {
  let timer
  function search() {
    clearTimeout(timer)
    void load()
  }
  watch(keyword, () => {
    clearTimeout(timer)
    timer = setTimeout(search, delay)
  })
  onBeforeUnmount(() => clearTimeout(timer))
  return search
}
