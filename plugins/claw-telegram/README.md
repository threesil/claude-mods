# Claw Telegram

A Claude Code mod that lets you talk to Claw from Telegram, the way you would with OpenClaw.

## Set up

1. In Telegram, message **@BotFather**, send `/newbot`, and copy the token.
2. Install the mod and paste the token when asked (it goes to secure storage).
3. Message your new bot. It replies with your chat id. Put that id in `/config` → claw-telegram → Your chat id.
4. Keep a `claude` session running. On an always-on machine, use `tmux`.

## What it does

- Your messages start a turn; the answer is sent back to your phone.
- Briefings and check-ins from claw-heartbeat are pushed to you (skips "nothing urgent").
- `/status` shows open tasks. `/approve` unlocks one action held by claw-guard for three minutes.
- Only your own chat id is accepted; everything else is ignored.
- With several sessions open, only one polls Telegram.

## Good to know

Messages go through Telegram's servers. Don't send secrets. Text only for now.

Requires Claude Code v2.1.287 or later. Tested with v2.1.288.
