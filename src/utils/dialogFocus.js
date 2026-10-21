const formControls = 'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)'

export function trapTab(event, panel, selector = formControls) {
  if (event.key !== 'Tab') return
  const controls = [...panel.querySelectorAll(selector)]
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
