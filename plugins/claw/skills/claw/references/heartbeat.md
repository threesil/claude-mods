# Heartbeat (proactive work)

OpenClaw "wakes up" at set times and checks whether there's anything to do. Here you do that with scheduled tasks.

## Where it works

- **Cowork:** create a scheduled task (e.g. weekdays at 07:30 and 13:00) with the instruction `Run the Claw heartbeat.` The computer must be on.
- **Claude Code with the claw-heartbeat mod (best):** keep a `claude` session open (on a server, inside `tmux` or `screen`, it runs 24/7). The mod triggers the briefing and check-ins itself; set `mode` to `auto-run` in `/config`. Add claw-telegram and the results arrive on your phone.
- **Claude Code without the mod:** cron / launchd / Task Scheduler running `claude -p "Run the Claw heartbeat"` in the directory containing `Claw/`. Note that non-interactive runs can never approve guarded actions, which is the safe default.
- **Regular Claude app:** no scheduled tasks. Say so honestly and offer alternatives: a daily calendar reminder or alarm saying "Ask Claw for your briefing", or switching to Cowork.

Help the user set it up: give the exact instruction text and suggested times.

## What the heartbeat does

1. Load context (SOUL, MEMORY, TASKS).
2. Check:
   - tasks due today/tomorrow or overdue;
   - meetings in the next 3 hours (and whether preparation is needed);
   - new email that needs action or comes from important people (see MEMORY → People);
   - "waiting on" items open for more than 3 working days.
3. Prepare what you can: draft replies, meeting prep, task updates. Don't send or delete anything.
4. Report **only if there's something to report**. Nothing notable: one line "✅ Heartbeat 13:00 — nothing urgent." and log it in the journal.
5. The first heartbeat of the day is the full briefing (`briefing.md`).
