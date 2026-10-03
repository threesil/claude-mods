# Claw Memory

A Claude Code mod that makes Claw's memory automatic and reliable.

- **Automatic context.** On the first prompt of every session (and after `/clear` or compaction) your `SOUL.md`, `MEMORY.md` and open tasks are attached for Claude. Later prompts get only the memory lines that match what you asked.
- **Deterministic memory tools.** Claude gets `remember`, `recall` and `forget` tools that edit `MEMORY.md` in code: no duplicates, dated entries, and anything that looks like a password, PIN, card number, IBAN or API key is refused.
- **Daily journal.** One line per turn in `journal/YYYY-MM-DD.md`, so "what did we discuss last week" has an answer.

Settings (`/config`): Claw folder, memory injection (`always`, `first-prompt`, `off`), auto journal.

Requires Claude Code v2.1.287 or later. Tested with v2.1.288.
