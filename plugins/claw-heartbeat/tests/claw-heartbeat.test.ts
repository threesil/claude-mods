import { expect, mock, test } from 'claude-code/testing'

const SEVEN = new Date(2026, 9, 5, 7, 58).getTime()

function world(on: any, store: Map<string, unknown>, submitted: string[], toasts: string[]) {
  const clock = mock.clock(on, { now: SEVEN })
  mock.env(on, { HOME: '/home/u' })
  on('store.get', ($: any, e: any) => ({ value: store.get(e.key) }))
  on('store.set', ($: any, e: any) => { store.set(e.key, e.value); return { value: undefined } })
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: '# Tasks\n\n## Open\n- [ ] Pay rent — due 2026-10-01\n' }))
  on('command.register', () => ({ value: undefined }))
  on('ui.toast', ($: any, e: any) => { toasts.push(e.text); return { value: undefined } })
  on('ui.status', () => ({ value: undefined }))
  on('prompt.submit', ($: any, e: any) => { submitted.push(e.text); return { text: e.text } })
  on('session.start', () => ({ cwd: '/work' }))
  return clock
}

test('auto-run fires the briefing once at 08:00 and a heartbeat later', { options: { mode: 'auto-run' } } as any, async ($, on) => {
  const store = new Map<string, unknown>([['lastBeat', SEVEN]])
  const submitted: string[] = []
  const toasts: string[] = []
  const clock = world(on, store, submitted, toasts)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  await clock.advance(60_000)
  expect(submitted).toEqual([])
  await clock.advance(2 * 60_000)
  expect(submitted.length).toBe(1)
  expect(submitted[0]).toContain('daily briefing')
  await clock.advance(10 * 60_000)
  expect(submitted.length).toBe(1)
  await clock.advance(60 * 60_000)
  expect(submitted.some((t) => t.includes('heartbeat'))).toBe(true)
  expect(toasts.some((t) => t.includes('1 overdue'))).toBe(true)
})

test('/claw-status reports the schedule', async ($, on) => {
  world(on, new Map(), [], [])
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const out: any = await $.command.run({ command: 'claw-status', args: '' })
  expect(out.text).toContain('Briefing: daily at 08:00')
  expect(out.text).toContain('1 overdue')
})
