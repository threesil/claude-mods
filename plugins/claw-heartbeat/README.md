# Claw Heartbeat

A Claude Code mod that wakes Claw up on a schedule, the way OpenClaw's heartbeat does.

- **Daily briefing** at a time you choose (default 08:00).
- **Check-ins** every N minutes: overdue and due-today tasks show under the prompt and as a toast.
- **Auto-run mode**: Claude runs the briefing and the heartbeat by itself when the session is idle. Combined with claw-telegram, results arrive on your phone.
- **Quiet hours** (default 22:00–07:00) and `/claw-status` to see the schedule.
- Runs once per machine even with several sessions open.

For a 24/7 Claw, run `claude` inside `tmux` on a small always-on machine.

Settings (`/config`): Claw folder, mode (`notify`, `auto-run`), interval, briefing time, quiet hours.

Requires Claude Code v2.1.287 or later. Tested with v2.1.288.
