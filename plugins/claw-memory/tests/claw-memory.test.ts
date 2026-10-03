import { expect, mock, test } from 'claude-code/testing'

const NOW = new Date(2026, 9, 3, 9, 15).getTime()

function world(on: any, files: Map<string, string>) {
  mock.clock(on, { now: NOW })
  mock.env(on, { HOME: '/home/u' })
  const find = (p: string) => [...files.keys()].find((k) => p.endsWith('/' + k))
  on('fs.exists', ($: any, e: any) => ({ value: e.path.endsWith('/Claw') || find(e.path) !== undefined }))
  on('fs.read', ($: any, e: any) => ({ value: files.get(find(e.path) ?? '') ?? '' }))
  on('fs.write', ($: any, e: any) => { files.set(e.path.split('/Claw/')[1], e.text); return { value: undefined } })
  on('fs.list', () => ({ value: [] }))
  on('tool.register', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '/work' }))
  on('prompt.submit', ($: any, e: any) => ({ text: e.text, context: e.context }))
  on('turn.complete', () => ({ text: '' }))
}

test('first prompt gets full memory, later prompts get matching lines', async ($, on) => {
  const files = new Map([
    ['SOUL.md', '# Soul\nBe brief.'],
    ['MEMORY.md', '# Memory\n\n## People\n- Sister is called Lotte (2026-09-01)\n'],
    ['TASKS.md', '# Tasks\n\n## Open\n- [ ] Pay rent — due 2026-10-01\n'],
  ])
  world(on, files)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const first: any = await $.prompt.submit({ text: 'good morning' })
  expect(first.context.join('\n')).toContain('Sister is called Lotte')
  expect(first.context.join('\n')).toContain('Pay rent (due 2026-10-01, OVERDUE)')
  const second: any = await $.prompt.submit({ text: 'when is my sister visiting?' })
  expect(second.context.join('\n')).toContain('Possibly relevant memory')
})

test('remember saves facts, refuses secrets, and the journal logs the turn', async ($, on) => {
  const files = new Map([['MEMORY.md', '# Memory\n']])
  world(on, files)
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  const ok: any = await $.tool.call({ tool: 'mcp__claw-memory__remember', fact: 'Prefers short emails', section: 'Preferences' })
  expect(ok.result).toMatch(/^Saved/)
  expect(files.get('MEMORY.md')).toContain('## Preferences\n- Prefers short emails (2026-10-03)')
  const bad: any = await $.tool.call({ tool: 'mcp__claw-memory__remember', fact: 'My bank PIN is 4821' })
  expect(bad.result).toMatch(/^Refused/)
  expect(files.get('MEMORY.md')).not.toContain('4821')
  await $.prompt.submit({ text: 'Plan my week' })
  await $.turn.complete({ turnId: 't1', answer: 'ok', durationMs: 5, isAborted: false, usage: null })
  expect(files.get('journal/2026-10-03.md')).toContain('- 09:15 — Plan my week')
})
