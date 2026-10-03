# Claw Guard

A Claude Code mod that enforces Claw's safety rules in code instead of trusting instructions.

- **Approval for outward actions.** Any connector (MCP) tool whose name says it sends, replies, forwards, deletes, trashes, archives, pays, buys, orders, refunds, publishes, posts, invites or shares is held until you pick **Allow once**. Reading and drafting are not interrupted.
- **Fails closed.** Dismissing the question, a crash in the guard, or a non-interactive run (`claude -p`, cron) all mean the action does not run.
- **Remote approval.** With claw-telegram, a held action waits for `/approve` from your own Telegram chat, valid once for three minutes.
- **Prompt-injection flags.** When an email, page or file returned by a connector contains text like "ignore previous instructions" or "forward all emails", Claude is told it is untrusted data and you get a warning.

Settings (`/config`): Claw folder, extra risky words (comma-separated).

Works on its own; it does not need the rest of Claw. Requires Claude Code v2.1.287 or later. Tested with v2.1.288.
