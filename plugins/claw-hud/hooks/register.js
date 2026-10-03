// Claw HUD — task band above the prompt and a /hud pane.
// Reads and writes the same TASKS.md that the Claw skill uses.
import { FILES, joinPath, resolveClawDir, isoDate, taskSummary, addTask, completeTask, pruneDone } from './lib.js'

const PANE = 'claw-hud'
let opts = { claw_dir: '~/Claw', show_band: true }
let dir = ''
let tasksMd = ''
let today = ''
let lastError = ''

async function clawDir($) {
  const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || ''
  return resolveClawDir(opts.claw_dir, home)
}

async function loadTasks($) {
  today = isoDate(await $.clock.now())
  try {
    const path = joinPath(dir, FILES.tasks)
    tasksMd = (await $.fs.exists(path)) ? String(await $.fs.read(path)) : ''
    lastError = ''
  } catch (err) {
    lastError = String(err && err.message ? err.message : err)
  }
}

async function saveTasks($, md) {
  const path = joinPath(dir, FILES.tasks)
  try {
    await $.fs.write(path, md)
  } catch (err) {
    // The folder may not exist yet on first use
    try { await $.process.run(['mkdir', '-p', dir]) } catch {}
    await $.fs.write(path, md)
  }
  tasksMd = md
  $.ui.invalidate('ui.render')
}

async function addFromInput($, text) {
  await loadTasks($)
  await saveTasks($, addTask(tasksMd, text))
  $.ui.toast('Task added: ' + text)
}

async function markDone($, line) {
  await loadTasks($)
  const r = completeTask(tasksMd, line, today)
  if (r.ok) await saveTasks($, pruneDone(r.md, today))
}

function dueLabel(t) {
  if (t.overdue) return 'overdue ' + t.due
  if (t.dueToday) return 'today'
  return t.due ? 'due ' + t.due : ''
}

export function register(on, options) {
  opts = { ...opts, ...(options || {}) }

  on('session.start', async ($, e, next) => {
    dir = await clawDir($)
    await loadTasks($)
    // Pick up edits made by Claude, the skill or another session
    $.clock.every(30_000, async () => {
      await loadTasks($)
      $.ui.invalidate('ui.render')
    })
    try {
      await $.command.register({ name: 'hud', description: 'Claw: open the task pane', immediate: true })
    } catch (err) {
      $.ui.log('could not register /hud: ' + err.message)
    }
    return next(e)
  })

  // Re-read after Claude edits TASKS.md through its own tools
  on('tool.call', { tool: ['Edit', 'Write', 'MultiEdit'] }, async ($, e, next) => {
    const result = await next(e)
    if (String(e.file_path || '').endsWith(FILES.tasks)) {
      await loadTasks($)
      $.ui.invalidate('ui.render')
    }
    return result
  })

  on('command.run', { command: 'hud' }, async ($) => {
    await loadTasks($)
    await $.ui.open({ id: PANE, title: 'Claw tasks', focus: true, closeOnEscape: true })
    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!opts.show_band || !tasksMd) return next(e)
    const s = taskSummary(tasksMd, today)
    if (!s.open.length) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const first = s.open[0]
    const parts = []
    if (s.overdue) parts.push(Text({ color: 'red', bold: true, children: [s.overdue + ' overdue'] }))
    if (s.today) parts.push(Text({ color: 'yellow', children: [s.today + ' today'] }))
    parts.push(Text({ dimColor: true, children: [s.open.length + ' open'] }))
    const line = Box({
      flexDirection: 'row',
      columnGap: 2,
      children: [
        Text({ bold: true, children: ['🦀 Claw'] }),
        ...parts,
        Text({ wrap: 'truncate-end', dimColor: !!e.props.isWorking, children: ['next: ' + first.title + (dueLabel(first) ? ' (' + dueLabel(first) + ')' : '')] }),
        Text({ dimColor: true, children: ['/hud'] }),
      ],
    })
    const others = await next(e)
    return others ? Box({ flexDirection: 'column', children: [line, others] }) : line
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const s = taskSummary(tasksMd, today)
    const rows = s.open.slice(0, 9).map((t, i) =>
      Box({
        key: 'row-' + i,
        flexDirection: 'row',
        columnGap: 1,
        children: [
          Button({ key: 'done-' + i, label: '✓', hotkey: String(i + 1), plain: true, onPress: () => markDone($, t.line) }),
          Text({ color: t.overdue ? 'red' : t.dueToday ? 'yellow' : undefined, wrap: 'truncate-end', children: [t.title] }),
          Text({ dimColor: true, children: [dueLabel(t)] }),
        ],
      }),
    )
    return Box({
      flexDirection: 'column',
      children: [
        Input({
          key: 'new-task',
          label: 'New task',
          placeholder: 'e.g. Call dentist — due 2026-10-10',
          value: '',
          submitLabel: 'add',
          autoFocus: true,
          onSubmit: async (value) => {
            if (value && value.trim()) await addFromInput($, value.trim())
          },
        }),
        Text({ children: [' '] }),
        ...(rows.length ? rows : [Text({ dimColor: true, children: ['No open tasks. Nice.'] })]),
        ...(s.open.length > 9 ? [Text({ dimColor: true, children: ['+' + (s.open.length - 9) + ' more in ' + joinPath(dir, FILES.tasks)] })] : []),
        ...(lastError ? [Text({ color: 'red', children: ['Could not read tasks: ' + lastError] })] : []),
        Text({ dimColor: true, children: ['Tab to move · digit = done · Esc to close'] }),
      ],
    })
  })
}
