# Memory

## Storage location (pick the first one that works)

1. **Local folder (Cowork / Claude Code).** If you have writable file access that persists between sessions, use a `Claw/` folder in the workspace the user shared (Cowork) or `~/Claw/` (Claude Code). This is the best option: files are plain and editable.
2. **Google Drive (or another cloud drive connector).** No persistent local folder, but a drive connector? Use a `Claw` folder there. If you can't edit existing files, work with separate notes (see "Append-only mode" below).
3. **Claude's built-in memory.** Neither available? Rely on Claude's memory feature (Settings → memory) and tell the user it needs to be switched on for persistent memory. In that case, summarize important facts explicitly so they get picked up.

Note: `/home/claude` and `/mnt/...` in the Claude app are wiped between conversations. They are not a memory location.

## Files

- `SOUL.md`: personality, tone, way of working. Only change when the user asks.
- `MEMORY.md`: stable facts, grouped under headings (About me, People, Work, Preferences, Agreements & decisions, Email rules). Keep it compact: one line per fact, with a date if it can go stale.
- `TASKS.md`: see `tasks.md`.
- `journal/YYYY-MM-DD.md`: a short log per day of what was done, decided and discussed. This lets you answer "what did we discuss about X last week".

## What to save

Yes: names and relationships, preferences, recurring appointments, decisions, ongoing projects, anything the user says to remember.
No: passwords and other secrets; health or other sensitive details unless the user explicitly asks; fleeting details that won't matter tomorrow.

## Updating

- New fact: add it under the right heading.
- Fact changes: replace the old line; don't keep both.
- Conflicts with what you already know: ask briefly which is correct.
- Report every save in one line with 📝 so the user can correct it.
- "Forget X": actually remove it and confirm.

## Retrieval

Search `MEMORY.md` first, then `journal/`, then (if relevant) email or calendar. Say honestly when you don't know something instead of guessing.

## Append-only mode (when existing files can't be edited)

- Read all files in the `Claw` folder whose names start with `Claw-memory`.
- New facts: create a new file `Claw-memory — YYYY-MM-DD — topic`.
- Once there are more than ~15 separate notes, create one summary `Claw-memory — summary YYYY-MM-DD` and ask the user to delete the old notes.
- The newest file wins when notes conflict.
