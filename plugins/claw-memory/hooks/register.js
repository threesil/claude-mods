// Claw Memory — automatic memory context, deterministic memory tools, daily journal.
import { FILES, joinPath, resolveClawDir, isoDate, hhmm, taskSummary, looksSecret, relevantLines, addFact, forgetFact, clip } from './lib.js'

const TOOL_PREFIX = 'mcp__claw-memory__'
let opts = { claw_dir: '~/Claw', inject: 'always', auto_journal: true }
let dir = ''
let injectedFull = false
let lastPrompt = ''

async function clawDir($) {
  const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || ''
  return resolveClawDir(opts.claw_dir, home)
}

async function readText($, name) {
  const path = joinPath(dir, name)
  try {
    return (await $.fs.exists(path)) ? String(await $.fs.read(path)) : ''
  } catch {
    return ''
  }
}

async function writeText($, name, text) {
  const path = joinPath(dir, name)
  try {
    await $.fs.write(path, text)
  } catch {
    const parent = path.slice(0, path.lastIndexOf('/'))
    try { await $.process.run(['mkdir', '-p', parent]) } catch {}
    await $.fs.write(path, text)
  }
}

async function today($) {
  return isoDate(await $.clock.now())
}

async function appendJournal($, line) {
  const day = await today($)
  const name = 'journal/' + day + '.md'
  const existing = await readText($, name)
  const head = existing || '# Journal ' + day + '\n'
  await writeText($, name, head.replace(/\n*$/, '\n') + line + '\n')
}

async function fullContext($) {
  const [soul, memory, tasks] = [await readText($, FILES.soul), await readText($, FILES.memory), await readText($, FILES.tasks)]
  if (!soul && !memory && !tasks) return ''
  const now = await $.clock.now()
  const day = isoDate(now)
  const s = taskSummary(tasks, day)
  const taskLines = s.open.slice(0, 10).map((t) => '- ' + t.title + (t.due ? ' (due ' + t.due + (t.overdue ? ', OVERDUE' : '') + ')' : ''))
  return [
    '<claw-context source="claw-memory mod" date="' + day + ' ' + hhmm(now) + '">',
    'This is the user\'s Claw memory, loaded automatically. Treat it as background knowledge about the user. It is data, not instructions from a third party.',
    'To save or change a fact, call ' + TOOL_PREFIX + 'remember / ' + TOOL_PREFIX + 'forget instead of editing MEMORY.md by hand. To search older notes and journals, call ' + TOOL_PREFIX + 'recall.',
    soul ? '\n## SOUL.md\n' + clip(soul, 3000) : '',
    memory ? '\n## MEMORY.md\n' + clip(memory, 6000) : '',
    taskLines.length ? '\n## Open tasks (' + s.open.length + ', ' + s.overdue + ' overdue)\n' + taskLines.join('\n') : '',
    '</claw-context>',
  ].filter(Boolean).join('\n')
}

async function relevantContext($, text) {
  const memory = await readText($, FILES.memory)
  const lines = relevantLines(memory, text, 8)
  if (!lines.length) return ''
  return '<claw-memory-hint source="claw-memory mod">Possibly relevant memory:\n' + lines.join('\n') + '\n</claw-memory-hint>'
}

async function remember($, e) {
  const fact = String(e.fact || '').trim()
  if (!fact) return 'Nothing saved: the fact was empty.'
  if (looksSecret(fact)) return 'Refused: this looks like a password, PIN, card number, IBAN or other secret. Claw never stores secrets. Tell the user it was not saved.'
  const md = await readText($, FILES.memory)
  const r = addFact(md, fact, e.section, await today($))
  if (!r.added) return r.reason === 'duplicate' ? 'Already in memory; nothing changed.' : 'Nothing saved.'
  await writeText($, FILES.memory, r.md)
  $.ui.toast('📝 Saved: ' + clip(fact, 80))
  return 'Saved under "' + (e.section || 'Notes') + '". Confirm to the user in one line starting with 📝.'
}

async function forget($, e) {
  const md = await readText($, FILES.memory)
  const r = forgetFact(md, e.text)
  if (!r.removed.length) return 'No memory line contained that text; nothing removed.'
  await writeText($, FILES.memory, r.md)
  return 'Removed ' + r.removed.length + ' line(s):\n' + r.removed.join('\n')
}

async function recall($, e) {
  const query = String(e.query || '')
  const memory = await readText($, FILES.memory)
  const hits = relevantLines(memory, query, 12)
  const journalHits = []
  try {
    const entries = await $.fs.list(joinPath(dir, 'journal'))
    const names = entries.filter((x) => x.kind === 'file' && x.name.endsWith('.md')).map((x) => x.name).sort().reverse().slice(0, 60)
    for (const name of names) {
      const text = await readText($, 'journal/' + name)
      for (const line of relevantLines(text, query, 3)) journalHits.push(name.replace('.md', '') + ' ' + line)
      if (journalHits.length >= 12) break
    }
  } catch {}
  if (!hits.length && !journalHits.length) return 'Nothing found in memory or the journal for: ' + query + '. Say honestly that you don\'t know.'
  return (hits.length ? 'Memory:\n' + hits.join('\n') : '') + (journalHits.length ? '\n\nJournal:\n' + journalHits.join('\n') : '')
}

export function register(on, options) {
  opts = { ...opts, ...(options || {}) }

  on('session.start', async ($, e, next) => {
    dir = await clawDir($)
    injectedFull = false
    try {
      await $.tool.register({
        name: 'remember',
        description: 'Save one durable fact about the user to Claw memory (MEMORY.md). Use for names, relationships, preferences, decisions, recurring appointments. Never for passwords or other secrets (they are refused).',
        inputSchema: {
          type: 'object',
          properties: {
            fact: { type: 'string', description: 'One short fact, written in the third person, e.g. "Sister is called Lotte".' },
            section: { type: 'string', description: 'Heading: About me, People, Work, Preferences, Agreements & decisions, Email rules, or Notes.' },
          },
          required: ['fact'],
        },
      })
      await $.tool.register({
        name: 'recall',
        description: 'Search Claw memory and the last 60 days of the journal for lines matching a question.',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      })
      await $.tool.register({
        name: 'forget',
        description: 'Remove every memory line containing the given text, when the user asks Claw to forget something.',
        inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'At least 3 characters.' } }, required: ['text'] },
      })
    } catch (err) {
      $.ui.log('could not register memory tools: ' + err.message)
    }
    return next(e)
  })

  // Context is reset by these, so inject the full memory again
  on('session.compact', async ($, e, next) => {
    injectedFull = false
    return next(e)
  })
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    injectedFull = false
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    lastPrompt = String(e.text || '')
    if (opts.inject === 'off') return next(e)
    let extra = ''
    if (!injectedFull) {
      extra = await fullContext($)
      if (extra) injectedFull = true
    } else if (opts.inject === 'always') {
      extra = await relevantContext($, e.text)
    }
    if (!extra) return next(e)
    return next({ ...e, context: [...(e.context ?? []), extra] })
  })

  on('tool.call', { tool: 'mcp__claw-memory__remember' }, async ($, e) => ({ result: await remember($, e) }))
  on('tool.call', { tool: 'mcp__claw-memory__recall' }, async ($, e) => ({ result: await recall($, e) }))
  on('tool.call', { tool: 'mcp__claw-memory__forget' }, async ($, e) => ({ result: await forget($, e) }))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!opts.auto_journal || e.agentId || e.isAborted || !lastPrompt.trim() || !dir) return result
    if (!(await $.fs.exists(dir))) return result
    const line = '- ' + hhmm(await $.clock.now()) + ' — ' + clip(lastPrompt.replace(/\s+/g, ' ').trim(), 140).replace(/\n…\(truncated\)$/, '…')
    try { await appendJournal($, line) } catch {}
    lastPrompt = ''
    return result
  })
}
