// Claw Heartbeat — scheduled briefing and check-ins inside a running session.
import { FILES, joinPath, resolveClawDir, isoDate, hhmm, parseClock, inQuietHours, taskSummary } from './lib.js'

const BRIEFING_PROMPT = 'Give me my Claw daily briefing (use the claw skill, references/briefing.md).'
const HEARTBEAT_PROMPT = 'Run the Claw heartbeat (use the claw skill, references/heartbeat.md). Report only what needs attention.'

let opts = { claw_dir: '~/Claw', mode: 'notify', interval_minutes: 60, briefing_time: '08:00', quiet_hours: '22:00-07:00' }
let dir = ''
let quiet = { start: null, end: null }
let lastStatus = ''
let nextBeatAt = 0

async function clawDir($) {
  const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || ''
  return resolveClawDir(opts.claw_dir, home)
}

async function readTasks($) {
  try {
    const path = joinPath(dir, FILES.tasks)
    return (await $.fs.exists(path)) ? String(await $.fs.read(path)) : ''
  } catch {
    return ''
  }
}

function minuteOfDay(ms) {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes()
}

async function briefingDue($, now) {
  const at = parseClock(opts.briefing_time)
  if (at === null || minuteOfDay(now) < at) return false
  const day = isoDate(now)
  if ((await $.store.get('lastBriefing')) === day) return false
  // Claim it before acting, so a second session on this machine skips it
  await $.store.set('lastBriefing', day)
  return true
}

async function beatDue($, now) {
  const every = Math.max(10, Number(opts.interval_minutes) || 60) * 60_000
  const last = Number((await $.store.get('lastBeat')) || 0)
  nextBeatAt = Math.max(last + every, now)
  if (now - last < every) return false
  await $.store.set('lastBeat', now)
  nextBeatAt = now + every
  return true
}

async function localCheck($, now) {
  const s = taskSummary(await readTasks($), isoDate(now))
  const parts = []
  if (s.overdue) parts.push(s.overdue + ' overdue')
  if (s.today) parts.push(s.today + ' due today')
  const text = parts.length ? '⏰ ' + parts.join(' · ') : ''
  if (text !== lastStatus) {
    lastStatus = text
    $.ui.status(text || undefined)
    if (text) $.ui.toast('Claw: ' + parts.join(', '))
  }
}

async function tick($) {
  const now = await $.clock.now()
  if (inQuietHours(minuteOfDay(now), quiet.start, quiet.end)) return
  const auto = opts.mode === 'auto-run'
  if (await briefingDue($, now)) {
    if (auto) {
      $.prompt.submit({ text: BRIEFING_PROMPT }).catch(() => {})
    } else {
      $.ui.toast('☀️ Time for your Claw briefing: type /claw:briefing')
    }
    return
  }
  if (await beatDue($, now)) {
    await localCheck($, now)
    if (auto) $.prompt.submit({ text: HEARTBEAT_PROMPT }).catch(() => {})
  }
}

export function register(on, options) {
  opts = { ...opts, ...(options || {}) }
  const [qs, qe] = String(opts.quiet_hours || '').split('-')
  quiet = { start: parseClock(qs), end: parseClock(qe) }

  on('session.start', async ($, e, next) => {
    dir = await clawDir($)
    $.clock.every(60_000, () => tick($))
    try {
      await $.command.register({ name: 'claw-status', description: 'Claw: show heartbeat and briefing schedule', immediate: true })
    } catch (err) {
      $.ui.log('could not register /claw-status: ' + err.message)
    }
    return next(e)
  })

  on('command.run', { command: 'claw-status' }, async ($) => {
    const now = await $.clock.now()
    const s = taskSummary(await readTasks($), isoDate(now))
    const lines = [
      'Mode: ' + opts.mode + (opts.mode === 'auto-run' ? ' (Claude runs check-ins by itself when idle)' : ' (reminders only)'),
      'Briefing: ' + (parseClock(opts.briefing_time) === null ? 'off' : 'daily at ' + opts.briefing_time + ' (last: ' + ((await $.store.get('lastBriefing')) || 'never') + ')'),
      'Heartbeat: every ' + opts.interval_minutes + ' min' + (nextBeatAt ? ', next around ' + hhmm(nextBeatAt) : ''),
      'Quiet hours: ' + (quiet.start === null ? 'none' : opts.quiet_hours) + (inQuietHours(minuteOfDay(now), quiet.start, quiet.end) ? ' (quiet now)' : ''),
      'Tasks: ' + s.open.length + ' open, ' + s.overdue + ' overdue, ' + s.today + ' due today',
      'Claw folder: ' + dir,
    ]
    return { text: lines.join('\n') }
  })
}
