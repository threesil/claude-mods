import { expect, mock, test } from 'claude-code/testing'

const TASKS = '# Tasks\n\n## Open\n- [ ] Send quote to Baker — due 2026-10-01 — priority high\n- [ ] Cancel insurance\n\n## Done (last 14 days)\n'
const NOW = new Date(2026, 9, 3, 10, 0).getTime()

function stubWorld(on: any, files: Map<string, string>) {
  mock.clock(on, { now: NOW })
  mock.env(on, { HOME: '/home/u' })
  on('fs.exists', ($: any, e: any) => ({ value: [...files.keys()].some((k) => e.path.endsWith(k)) }))
  on('fs.read', ($: any, e: any) => ({ value: files.get([...files.keys()].find((k) => e.path.endsWith(k)) || '') ?? '' }))
  on('fs.write', ($: any, e: any) => { files.set('TASKS.md', e.text ?? e.content ?? e.data); return { value: undefined } })
  on('command.register', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', () => ({ cwd: '/work' }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by Claude Code'] }))
}

const BAND = {
  plugin: 'claw-hud', component: 'AbovePrompt', requestId: 'band', viewport: { columns: 120, rows: 40 },
  props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 116, scroll: { offset: 0, bodyRows: 4 }, view: {} },
} as const

const PANE = {
  plugin: 'claw-hud', component: 'Pane', requestId: 'claw-hud', viewport: { columns: 120, rows: 40 },
  props: { title: 'Claw tasks', isFocused: true, bodyColumns: 60, placement: 'inline', scroll: { offset: 0, bodyRows: 12 }, view: {} },
} as const

test('band shows overdue count and the next task', async ($, on) => {
  const files = new Map([['TASKS.md', TASKS]])
  stubWorld(on, files)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: '1 overdue' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^next: Send quote to Baker/ })).toBeDefined()
    await ui.unmount()
  }
})

test('pane adds a task and ticks one off', async ($, on) => {
  const files = new Map([['TASKS.md', TASKS]])
  stubWorld(on, files)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await $.command.run({ command: 'hud', args: '' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.input({ key: 'new-task', text: 'Call dentist — due 2026-10-03' })
  expect(files.get('TASKS.md')).toContain('- [ ] Call dentist — due 2026-10-03')
  await ui.press({ key: 'done-0' })
  expect(files.get('TASKS.md')).toContain('- [x] Send quote to Baker — 2026-10-03')
  expect(files.get('TASKS.md')).not.toContain('- [ ] Send quote to Baker')
})
