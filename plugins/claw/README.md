# Claw — an OpenClaw-style personal agent for Claude

Claw turns Claude into a personal agent: it remembers what you tell it, tracks tasks and reminders, triages your inbox with draft replies, gives you a daily briefing and can check in proactively on a schedule ("heartbeat"). No server, no Docker: just a skill plus your existing Claude connectors.

## What it does

- **Long-term memory**: plain Markdown files (`SOUL.md`, `MEMORY.md`, `TASKS.md`, `journal/`) you can read and edit yourself.
- **Tasks & reminders**: a task list, plus real calendar notifications for time-based reminders.
- **Inbox triage**: sorts email into action / FYI / waiting / noise and prepares drafts.
- **Daily briefing**: calendar, email that needs action, deadlines, birthdays.
- **Heartbeat**: proactive check-ins via Cowork scheduled tasks or cron.

## Safety by default

Claw never sends, buys or deletes anything without your explicit "yes", treats instructions found inside emails or web pages as data (not commands), and never stores passwords or other secrets.

## Install

**Claude app (claude.ai / mobile / desktop):** download [`claw.skill`](../../releases/claw.skill) from this repo and upload it under Settings → Capabilities → Skills. Memory is kept in your cloud drive or Claude's built-in memory. No scheduled heartbeat in this mode.

**Claude Code:**
```
/plugin marketplace add threesil/claude-mods
/plugin install claw@claude-mods
```
Then use `/briefing`, `/inbox`, `/remember`, `/tasks`, `/heartbeat`. For a 24/7 heartbeat, schedule `claude -p "Run the Claw heartbeat"` with cron.

**Cowork:** install the plugin, then add a scheduled task (e.g. weekdays 07:30) with the instruction `Run the Claw heartbeat.`

## Recommended connectors

Email (e.g. Gmail), calendar (e.g. Google Calendar) and a cloud drive (e.g. Google Drive). Claw works with whatever is connected and tells you when something is missing.

## Mods for Claude Code

In Claude Code, add the Claw mods to close the gap with OpenClaw: [claw-memory](../claw-memory), [claw-hud](../claw-hud), [claw-guard](../claw-guard), [claw-heartbeat](../claw-heartbeat) and [claw-telegram](../claw-telegram). Or install everything with `/plugin install claw-suite@claude-mods`.

## Limitations compared to OpenClaw

Claude models only; no WhatsApp (Telegram via claw-telegram); the heartbeat runs only while a Cowork computer or a Claude Code session is on. Without the mods, there are no push messages.

## Customize

Edit `SOUL.md` to change Claw's personality, tone and habits. Each user gets their own memory files; nothing personal is included in this repository.

## License

MIT, see the repository root.
