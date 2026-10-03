// Claw Telegram — a private chat bridge between your phone and a running Claude Code session.
import { FILES, joinPath, resolveClawDir, isoDate, taskSummary, chunkText, clip } from './lib.js'

const API = 'https://api.telegram.org/bot'
const REMOTE_MARK = 'via Telegram (Claw remote)'
const REMOTE_WINDOW_MS = 15 * 60_000
const APPROVE_WINDOW_MS = 3 * 60_000
const LEADER_STALE_MS = 30_000

let opts = { bot_token: '', chat_id: '', claw_dir: '~/Claw', poll_seconds: 4, forward_checkins: true }
let dir = ''
let me = ''
let polling = false
let pendingReplies = 0
let forwardNext = false
let warnedStranger = false

async function clawDir($) {
  const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || ''
  return resolveClawDir(opts.claw_dir, home)
}

async function tg($, method, body) {
  const res = await $.http.fetch(API + opts.bot_token + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  let data = {}
  try { data = JSON.parse(res.text || '{}') } catch {}
  if (!res.ok || !data.ok) throw new Error('Telegram ' + method + ' failed: ' + (data.description || res.status))
  return data.result
}

async function send($, text) {
  for (const part of chunkText(text, 3900)) {
    await tg($, 'sendMessage', { chat_id: opts.chat_id, text: part, disable_web_page_preview: true })
  }
}

async function readState($) {
  try {
    const path = joinPath(dir, FILES.state)
    return (await $.fs.exists(path)) ? JSON.parse(String(await $.fs.read(path))) : {}
  } catch {
    return {}
  }
}

async function patchState($, patch) {
  const state = await readState($)
  try { await $.fs.write(joinPath(dir, FILES.state), JSON.stringify({ ...state, ...patch }, null, 2)) } catch {}
}

async function isLeader($, now) {
  const leader = (await $.store.get('leader')) || {}
  if (leader.id && leader.id !== me && now - (leader.at || 0) < LEADER_STALE_MS) return false
  await $.store.set('leader', { id: me, at: now })
  return true
}

async function statusText($) {
  const now = await $.clock.now()
  let tasks = ''
  try {
    const path = joinPath(dir, FILES.tasks)
    tasks = (await $.fs.exists(path)) ? String(await $.fs.read(path)) : ''
  } catch {}
  const s = taskSummary(tasks, isoDate(now))
  const top = s.open.slice(0, 5).map((t) => '• ' + t.title + (t.overdue ? ' (overdue)' : t.dueToday ? ' (today)' : ''))
  return ['🦀 Claw is online.', s.open.length + ' open tasks, ' + s.overdue + ' overdue.', ...top].join('\n')
}

async function handleMessage($, msg) {
  const chatId = String(msg.chat && msg.chat.id)
  const text = String(msg.text || '').trim()
  if (!opts.chat_id) {
    await tg($, 'sendMessage', { chat_id: chatId, text: 'Hi! Your chat id is ' + chatId + '. Put it in Claude Code under /config → claw-telegram → Your chat id, then message me again.' })
    $.ui.toast('Telegram chat id: ' + chatId + ' (set it in /config)')
    return
  }
  if (chatId !== String(opts.chat_id)) {
    if (!warnedStranger) $.ui.log('ignored a message from an unknown chat ' + chatId)
    warnedStranger = true
    return
  }
  if (!text) {
    await send($, 'I can only read text messages for now.')
    return
  }
  const now = await $.clock.now()
  if (/^\/approve\b/i.test(text)) {
    const state = await readState($)
    await patchState($, { approveUntil: now + APPROVE_WINDOW_MS, pendingApproval: null })
    const what = state.pendingApproval ? state.pendingApproval.tool + ' ' + clip(state.pendingApproval.args, 200) : 'the next guarded action'
    await send($, '✅ Approved once, for 3 minutes: ' + what)
    return
  }
  if (/^\/(status|start)\b/i.test(text)) {
    await send($, await statusText($))
    return
  }
  if (text.startsWith('/')) {
    await send($, 'Commands: /status, /approve. Anything else is a normal message to Claw.')
    return
  }
  await patchState($, { remoteUntil: now + REMOTE_WINDOW_MS })
  pendingReplies += 1
  try { await tg($, 'sendChatAction', { chat_id: opts.chat_id, action: 'typing' }) } catch {}
  $.ui.log('Telegram: ' + clip(text, 80))
  $.prompt.submit({
    text: 'Message from the user ' + REMOTE_MARK + '. Reply in plain text, short enough for a phone; your final answer is sent back to Telegram automatically. ' +
      'If an action needs approval, say exactly what and ask them to reply /approve.\n\n' + text,
  }).catch((err) => {
    pendingReplies = Math.max(0, pendingReplies - 1)
    $.ui.log('could not submit Telegram message: ' + err.message)
  })
}

async function poll($) {
  if (polling || !opts.bot_token) return
  polling = true
  try {
    const now = await $.clock.now()
    if (!(await isLeader($, now))) return
    const offset = Number((await $.store.get('offset')) || 0)
    const updates = await tg($, 'getUpdates', { offset, timeout: 0, allowed_updates: ['message'] })
    for (const u of updates || []) {
      await $.store.set('offset', u.update_id + 1)
      if (u.message) await handleMessage($, u.message)
    }
  } catch (err) {
    $.ui.status('Telegram: ' + clip(String(err.message || err), 60))
  } finally {
    polling = false
  }
}

export function register(on, options) {
  opts = { ...opts, ...(options || {}) }

  on('session.start', async ($, e, next) => {
    dir = await clawDir($)
    me = String((await $.session.id()) || 'session')
    if (!opts.bot_token) {
      $.ui.status('Telegram: add your bot token in /plugin → claw-telegram → configure')
      return next(e)
    }
    const every = Math.min(60, Math.max(2, Number(opts.poll_seconds) || 4)) * 1000
    $.clock.every(every, () => poll($))
    return next(e)
  })

  // Remember which turns should be answered on the phone
  on('prompt.submit', async ($, e, next) => {
    const text = String(e.text || '')
    if (opts.forward_checkins && /Claw (daily briefing|heartbeat)/.test(text) && !text.includes(REMOTE_MARK)) forwardNext = true
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId || !opts.bot_token || !opts.chat_id) return result
    const answer = String(e.answer || '').trim()
    if (pendingReplies > 0) {
      pendingReplies -= 1
      try { await send($, e.isAborted ? '⚠️ That turn was interrupted.' : answer || '(no text answer)') } catch (err) { $.ui.log(err.message) }
    } else if (forwardNext) {
      forwardNext = false
      if (answer && !/nothing (urgent|to report|dringends)/i.test(answer)) {
        try { await send($, answer) } catch (err) { $.ui.log(err.message) }
      }
    }
    return result
  })

  on('session.end', async ($, e, next) => {
    try {
      const leader = (await $.store.get('leader')) || {}
      if (leader.id === me) await $.store.delete('leader')
    } catch {}
    return next(e)
  })
}
