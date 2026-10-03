# claude-mods

Mods for Claude by threesil. The headline mod is **Claw**: an OpenClaw-style personal agent built from a skill that works everywhere, plus Claude Code mods that add what a skill can't do on its own.

## Install

**Claude Code** (all mods):
```
/plugin marketplace add threesil/claude-mods
/plugin install claw-suite@claude-mods
```
Or install single mods, for example `/plugin install claw-guard@claude-mods`. Update with `/plugin marketplace update claude-mods`.

**Cowork:** install the `claw` plugin from this marketplace. The mods need Claude Code.

**Claude app (claude.ai, desktop, mobile):** download [`releases/claw.skill`](releases/claw.skill) and upload it under Settings → Capabilities → Skills.

## What's inside

| Plugin | Type | Works in | What it does |
|---|---|---|---|
| [claw](plugins/claw) | skill + commands | App, Cowork, Claude Code | Memory, tasks, inbox triage, briefing, heartbeat instructions |
| [claw-memory](plugins/claw-memory) | mod | Claude Code | Memory injected automatically; remember/recall/forget tools that refuse secrets; daily journal |
| [claw-hud](plugins/claw-hud) | mod | Claude Code | Task band above the prompt; `/hud` pane to add and tick off tasks |
| [claw-guard](plugins/claw-guard) | mod | Claude Code | Your OK before anything is sent, deleted, paid or shared; prompt-injection flags |
| [claw-heartbeat](plugins/claw-heartbeat) | mod | Claude Code | Daily briefing and scheduled check-ins, quiet hours, optional auto-run |
| [claw-telegram](plugins/claw-telegram) | mod | Claude Code | Chat with Claw from your phone; pushed briefings; `/approve` from Telegram |
| [claw-suite](plugins/claw-suite) | bundle | Claude Code | Installs all of the above |

All Claw plugins share one folder (default `~/Claw`) with `SOUL.md`, `MEMORY.md`, `TASKS.md` and `journal/`. Plain Markdown you can read and edit yourself.

## Claw vs OpenClaw

| | OpenClaw | Claw (with mods) |
|---|---|---|
| Memory | Markdown files | Markdown files, injected automatically |
| Chat from your phone | WhatsApp, Telegram, more | Telegram, plus the Claude mobile app |
| Proactive heartbeat | Yes | Yes (Claude Code session or Cowork) |
| Approval before sending or deleting | Configurable | Enforced in code, fails closed |
| Prompt-injection defence | Limited | Flags suspicious emails and pages |
| Models | Many providers | Claude |
| Runs without your computer on | On a server | On a server (`claude` in `tmux`) |

## About mods

Mods are JavaScript plugins that run inside Claude Code (v2.1.287+). They are **not sandboxed**: they run with your permissions. Everything here is plain, readable source with tests; read it before you install, as you should with any mod. Tested with Claude Code v2.1.288; the mods API can change between releases.

## Repository layout

```
claude-mods/
├── .claude-plugin/marketplace.json   # lists every plugin
├── plugins/<name>/                   # one folder per plugin
│   ├── .claude-plugin/plugin.json
│   ├── hooks/{hooks.json,register.js,lib.js}   # mods only
│   ├── skills/ commands/             # the claw core plugin
│   └── tests/*.test.ts               # run with `claude plugin test`
├── shared/claw-lib.js                # source of every mod's lib.js
├── scripts/                          # sync-lib.sh, check-all.sh, test-lib.mjs
├── releases/claw.skill               # for the Claude app
└── .github/workflows/check.yml       # validates and tests on every push
```

## Contributing a mod

1. Create `plugins/<name>/` with `.claude-plugin/plugin.json`, `hooks/hooks.json` and `hooks/register.js`. Don't start the name with `claude-`.
2. Add an entry to `.claude-plugin/marketplace.json`.
3. Add tests under `tests/` and run `./scripts/check-all.sh`.
4. If you change `shared/claw-lib.js`, run `./scripts/sync-lib.sh`.

## License

MIT
