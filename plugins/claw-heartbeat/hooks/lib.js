// claw-lib.js — shared, pure helpers for the Claw mods.
// No mods API ($) in here: hooks modules may not pass $ to imported functions.
// Source of truth lives in /shared; scripts/sync-lib.sh copies it into each mod.

export const FILES = { soul: 'SOUL.md', memory: 'MEMORY.md', tasks: 'TASKS.md', state: '.claw-state.json' }

/** Join path parts with forward slashes and squash duplicates. */
export function joinPath(...parts) {
  return parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/{2,}/g, '/')
}

/** Resolve the Claw folder from a configured value and the home directory. */
export function resolveClawDir(configured, home) {
  const raw = (configured || '').trim() || '~/Claw'
  if (raw === '~') return home || '.'
  if (raw.startsWith('~/')) return joinPath(home || '.', raw.slice(2))
  return raw.replace(/\\/g, '/')
}

/** YYYY-MM-DD in local time. */
export function isoDate(ms) {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

/** HH:MM in local time. */
export function hhmm(ms) {
  const d = new Date(ms)
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

/** Minutes since local midnight for "HH:MM", or null. */
export function parseClock(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((text || '').trim())
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** True when the minute-of-day falls inside a quiet window that may wrap midnight. */
export function inQuietHours(minuteOfDay, start, end) {
  if (start == null || end == null || start === end) return false
  return start < end ? minuteOfDay >= start && minuteOfDay < end : minuteOfDay >= start || minuteOfDay < end
}

// ---------- Tasks ----------

const TASK_RE = /^\s*[-*] \[( |x|X)\] (.+?)\s*$/
const DUE_RE = /\bdue (\d{4}-\d{2}-\d{2})\b/i
const PRIO_RE = /\bpriority (high|medium|low)\b/i
const SECTION_OPEN = '## Open'
const SECTION_DONE = '## Done (last 14 days)'

/** Parse TASKS.md into a flat list, remembering section and line number. */
export function parseTasks(md) {
  const lines = (md || '').split(/\r?\n/)
  const tasks = []
  let section = ''
  lines.forEach((line, index) => {
    if (/^##\s+/.test(line)) { section = line.replace(/^##\s+/, '').trim(); return }
    const m = TASK_RE.exec(line)
    if (!m) return
    const text = m[2]
    const due = (DUE_RE.exec(text) || [])[1] || null
    const priority = ((PRIO_RE.exec(text) || [])[1] || '').toLowerCase() || null
    const title = text.split(/\s+—\s+/)[0].trim()
    tasks.push({ index, line, text, title, done: m[1] !== ' ', section, due, priority })
  })
  return tasks
}

/** Open tasks (not done, not in the Done section), sorted overdue → today → soon → undated. */
export function openTasks(md, todayISO) {
  const rank = (t) => {
    if (!t.due) return 3
    if (t.due < todayISO) return 0
    if (t.due === todayISO) return 1
    return 2
  }
  return parseTasks(md)
    .filter((t) => !t.done && !/^done/i.test(t.section))
    .map((t) => ({ ...t, overdue: !!t.due && t.due < todayISO, dueToday: t.due === todayISO }))
    .sort((a, b) => rank(a) - rank(b) || (a.due || '9').localeCompare(b.due || '9') || (a.priority === 'high' ? -1 : 0))
}

/** Counts used by the HUD and the heartbeat. */
export function taskSummary(md, todayISO) {
  const open = openTasks(md, todayISO)
  return {
    open,
    overdue: open.filter((t) => t.overdue).length,
    today: open.filter((t) => t.dueToday).length,
    waiting: open.filter((t) => /^waiting/i.test(t.section)).length,
  }
}

function ensureSection(lines, heading) {
  let at = lines.findIndex((l) => l.trim() === heading)
  if (at === -1) {
    if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('')
    lines.push(heading)
    at = lines.length - 1
  }
  return at
}

/** Insert "- [ ] text" at the end of the Open section. */
export function addTask(md, text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return md
  const lines = (md && md.trim() ? md : '# Tasks\n').split(/\r?\n/)
  const at = ensureSection(lines, SECTION_OPEN)
  let insert = at + 1
  while (insert < lines.length && !/^##\s+/.test(lines[insert])) insert++
  while (insert > at + 1 && lines[insert - 1].trim() === '') insert--
  lines.splice(insert, 0, '- [ ] ' + clean)
  return lines.join('\n')
}

/** Mark the task on a given exact line as done and move it to the Done section. */
export function completeTask(md, exactLine, todayISO) {
  const lines = (md || '').split(/\r?\n/)
  const i = lines.findIndex((l) => l === exactLine)
  if (i === -1) return { md, ok: false }
  const m = TASK_RE.exec(lines[i])
  if (!m) return { md, ok: false }
  lines.splice(i, 1)
  const title = m[2].split(/\s+—\s+/)[0].trim()
  const at = ensureSection(lines, SECTION_DONE)
  lines.splice(at + 1, 0, '- [x] ' + title + ' — ' + todayISO)
  return { md: lines.join('\n'), ok: true }
}

/** Drop Done items older than `days`. */
export function pruneDone(md, todayISO, days = 14) {
  const cutoff = isoDate(new Date(todayISO + 'T12:00:00').getTime() - days * 86400000)
  return (md || '').split(/\r?\n/).filter((l) => {
    const m = /^\s*[-*] \[[xX]\] .+ — (\d{4}-\d{2}-\d{2})\s*$/.exec(l)
    return !m || m[1] >= cutoff
  }).join('\n')
}

// ---------- Memory ----------

const SECRET_PATTERNS = [
  /\b(pass(word|wd)?|wachtwoord|pin(code)?|passcode|cvv|cvc)\b\s*[:=is]+\s*\S+/i,
  /\b(api[_ -]?key|secret|token|bearer)\b\s*[:=]?\s*[A-Za-z0-9_\-.]{12,}/i,
  /\b(sk|pk|ghp|gho|xox[abp])[-_][A-Za-z0-9]{10,}/,
  /\bNL\d{2}[A-Z]{4}\d{10}\b/,                 // Dutch IBAN
  /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/,          // generic IBAN
  /\b(?:\d[ -]?){13,19}\b/,                    // card-like number
  /\b(bsn|ssn|social security)\b\D{0,10}\d{8,9}\b/i,
]

/** True when text looks like a secret that must never be stored. */
export function looksSecret(text) {
  return SECRET_PATTERNS.some((re) => re.test(String(text || '')))
}

const STOP = new Set(('the a an and or of to in on at for with is are was were be my me i you it this that what who when where how do does did ' +
  'de het een en of van te in op bij voor met is zijn was waren mijn ik jij je wat wie wanneer waar hoe doe deed').split(' '))

function words(text) {
  return String(text || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
}

/** Memory lines (bullets) that share the most words with the query. */
export function relevantLines(md, query, max = 8) {
  const q = new Set(words(query))
  if (!q.size) return []
  return (md || '').split(/\r?\n/)
    .filter((l) => /^\s*[-*] /.test(l))
    .map((line) => ({ line: line.trim(), score: words(line).filter((w) => q.has(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.line)
}

/** Add a fact as a bullet under a heading (created if missing); skips exact duplicates. */
export function addFact(md, fact, section, todayISO) {
  const clean = String(fact || '').replace(/\s+/g, ' ').trim().replace(/^[-*]\s+/, '')
  if (!clean) return { md, added: false, reason: 'empty' }
  const lines = (md && md.trim() ? md : '# Memory\n').split(/\r?\n/)
  if (lines.some((l) => l.replace(/^\s*[-*]\s+/, '').replace(/\s+\(\d{4}-\d{2}-\d{2}\)$/, '').trim().toLowerCase() === clean.toLowerCase())) {
    return { md, added: false, reason: 'duplicate' }
  }
  const heading = '## ' + (String(section || '').trim() || 'Notes')
  const at = ensureSection(lines, heading)
  let insert = at + 1
  while (insert < lines.length && !/^##\s+/.test(lines[insert])) insert++
  while (insert > at + 1 && lines[insert - 1].trim() === '') insert--
  lines.splice(insert, 0, '- ' + clean + ' (' + todayISO + ')')
  return { md: lines.join('\n'), added: true }
}

/** Remove bullets containing the given text (case-insensitive). Returns removed lines. */
export function forgetFact(md, text) {
  const needle = String(text || '').trim().toLowerCase()
  if (needle.length < 3) return { md, removed: [] }
  const removed = []
  const kept = (md || '').split(/\r?\n/).filter((l) => {
    const hit = /^\s*[-*] /.test(l) && l.toLowerCase().includes(needle)
    if (hit) removed.push(l.trim())
    return !hit
  })
  return { md: kept.join('\n'), removed }
}

/** Trim long text for prompt context. */
export function clip(text, max) {
  const t = String(text || '')
  return t.length <= max ? t : t.slice(0, max) + '\n…(truncated)'
}

// ---------- Guard ----------

export const RISKY_WORDS = ['send', 'reply', 'forward', 'delete', 'trash', 'remove', 'archive', 'purchase', 'buy', 'order',
  'pay', 'payment', 'transfer', 'refund', 'publish', 'post', 'invite', 'share', 'permission', 'drop', 'destroy']

/** True when an MCP tool name looks like it acts on the outside world. */
export function isRiskyTool(toolName, extraWords = []) {
  const name = String(toolName || '')
  if (!name.startsWith('mcp__')) return false
  if (/^mcp__claw[-_]/.test(name)) return false
  const action = name.split('__').slice(2).join('__').toLowerCase()
  const parts = action.split(/[^a-z0-9]+/)
  const list = RISKY_WORDS.concat(extraWords.map((w) => String(w).trim().toLowerCase()).filter(Boolean))
  if (/^(get|list|search|read|fetch|find|query|describe|download)_/.test(action) && !/(send|delete|trash|pay|purchase)/.test(action)) return false
  return list.some((w) => parts.includes(w) || action.startsWith(w))
}

const INJECTION_RE = /(ignore (all |any )?(previous|prior|above) (instructions|prompts)|disregard (your|all) (instructions|rules)|you are now (a|an|in)|new system prompt|forward (all|every) (emails?|messages|invoices)|send (your|the) (password|credentials|api key)|negeer (alle )?(vorige|eerdere) instructies)/i

/** True when tool output contains a likely prompt-injection phrase. */
export function looksLikeInjection(text) {
  return INJECTION_RE.test(String(text || ''))
}

/** Short, single-line JSON for display. */
export function summarizeArgs(e, max = 280) {
  const copy = {}
  for (const [k, v] of Object.entries(e || {})) {
    if (k === 'tool' || k === 'toolUseId' || k === 'agentId') continue
    copy[k] = v
  }
  const s = JSON.stringify(copy)
  return s.length > max ? s.slice(0, max) + '…' : s
}

// ---------- Telegram ----------

/** Split long text into Telegram-sized chunks on paragraph/line boundaries. */
export function chunkText(text, size = 3900) {
  const out = []
  let rest = String(text || '').trim()
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n\n', size)
    if (cut < size / 2) cut = rest.lastIndexOf('\n', size)
    if (cut < size / 2) cut = rest.lastIndexOf(' ', size)
    if (cut < size / 2) cut = size
    out.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) out.push(rest)
  return out
}
