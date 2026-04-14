# Todoist Migrate

An Obsidian plugin that migrates TODO items from markdown notes to Todoist, leaving a linked placeholder behind.

When a task like `- [ ] Buy milk` is migrated, it becomes:

```
- [→] ~~Buy milk~~ [(This Task Migrated to Todoist)](https://app.todoist.com/app/task/123)
```

The task is created in Todoist with a backlink to the originating note.

## Features

- **Single-file migration** — migrate TODOs from the active note via command palette or ribbon icon
- **Vault-wide migration** — scan all markdown files and migrate TODOs in bulk
- **Auto-sync heartbeat** — configurable timer (default 5 min) that automatically migrates new TODOs
- **Dry run mode** — preview what would be migrated without creating tasks or modifying files (enabled by default)
- **Deduplication** — tasks already in Todoist are skipped based on content hash
- **Excluded folders** — skip entire folder trees during vault-wide migration
- **Per-file opt-out** — add `todoist: false` to YAML frontmatter to skip individual notes
- **File age threshold** — skip recently modified files to avoid migrating partially-typed TODOs
- **Debug logging** — optional detailed API logging to a file in the vault

## Setup

### Prerequisites

- [Obsidian](https://obsidian.md) v0.15.0+
- Node.js 18+ (for building from source)
- A [Todoist](https://todoist.com) account and API token

### Install from source

```bash
git clone https://github.com/areese801/obsidian-todoist.git
cd obsidian-todoist
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault:

```bash
mkdir -p <vault>/.obsidian/plugins/todoist-migrate
cp main.js manifest.json styles.css <vault>/.obsidian/plugins/todoist-migrate/
```

Reload Obsidian and enable **Todoist Migrate** in Settings → Community plugins.

### Configure

1. Go to Settings → Todoist Migrate
2. Paste your Todoist API token (get it from Todoist → Settings → Integrations → Developer)
3. Review the default settings:
   - **Dry run mode** is ON by default — migration commands will generate a preview report instead of creating tasks
   - **Excluded folders** — comma-separated folder paths to skip (e.g. `_templates, Recipes`)
   - **Auto-sync** is OFF by default
   - **File age threshold** — 60 seconds (files modified more recently are skipped)

## Usage

### Commands

Open the command palette (Cmd/Ctrl+P) to access:

| Command | Description |
|---------|-------------|
| **Migrate todos in current file to Todoist** | Migrate TODOs from the active note |
| **Migrate all todos in vault to Todoist** | Scan all markdown files and migrate TODOs |

The ribbon icon (checkbox with arrow) triggers single-file migration on the active note.

### Dry run mode

When dry run mode is enabled (the default), vault-wide migration writes a report to `todoist-migrate-dry-run.md` in the vault root instead of creating tasks. Use this to:

1. See which tasks would be migrated
2. Identify folders or notes that should be excluded
3. Verify your configuration before going live

Disable dry run mode in settings when you're ready for actual migration.

### Excluding notes

**By folder** — add folder paths to the "Excluded folders" setting:
```
_templates, Computer/Dagster, Recipes
```
Subfolders are excluded automatically.

**By frontmatter** — add `todoist: false` to a note's YAML frontmatter:
```yaml
---
todoist: false
---
```

### Auto-sync

When enabled, the plugin scans the vault on a timer and migrates new TODOs automatically. Auto-sync is disabled while dry run mode is active.

## Output files

The plugin may create these files in your vault root:

| File | Purpose | Created when |
|------|---------|--------------|
| `todoist-migrate-dry-run.md` | Preview report of tasks that would be migrated | Dry run mode is on and vault migration runs |
| `todoist-migrate-debug.md` | API request/response debug log | Debug logging is enabled in settings |

## Development

```bash
npm run dev          # watch mode
npm run build        # production build
npm test             # run vitest suite
npm run test:watch   # vitest in watch mode
npm run lint         # eslint
```

## License

0-BSD
