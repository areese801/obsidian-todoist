import {Notice, Plugin, addIcon, TFile} from "obsidian";

const CHECKBOX_EXIT_ICON_ID = "todoist-migrate-checkbox-exit";
const CHECKBOX_EXIT_ICON_SVG = `
<g fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M65 42 V20 H15 V80 H65 V58" />
  <path d="M32 50 H88" />
  <path d="M72 34 L88 50 L72 66" />
</g>
`;
import {DEFAULT_SETTINGS, TodoistMigrateSettings, TodoistMigrateSettingTab} from "./settings";
import {migrateActiveFile, migrateVault} from "./migrator";
import {MigrationResult} from "./types";

export default class TodoistMigratePlugin extends Plugin {
	settings: TodoistMigrateSettings;
	private autoSyncIntervalId: number | null = null;
	private autoSyncRunning = false;

	async onload() {
		await this.loadSettings();

		addIcon(CHECKBOX_EXIT_ICON_ID, CHECKBOX_EXIT_ICON_SVG);

		this.addRibbonIcon(CHECKBOX_EXIT_ICON_ID, "Migrate todos to Todoist", async () => {
			await this.runMigrateActiveFile();
		});

		this.addCommand({
			id: "migrate-current-file",
			name: "Migrate todos in current file to Todoist",
			callback: async () => {
				await this.runMigrateActiveFile();
			},
		});

		this.addCommand({
			id: "migrate-vault",
			name: "Migrate all todos in vault to Todoist",
			callback: async () => {
				await this.runMigrateVault();
			},
		});

		this.addSettingTab(new TodoistMigrateSettingTab(this.app, this));
		this.startAutoSync();
	}

	private async runMigrateActiveFile() {
		if (!this.validateApiToken()) return;

		const log = this.debugLog.bind(this);
		try {
			const result = await migrateActiveFile(
				this.app,
				this.settings.todoistApiToken,
				this.settings.defaultDueString,
				log,
			);
			this.showResultNotice(result);
		} catch (e) {
			new Notice(`Migration failed: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	private async runMigrateVault() {
		if (!this.validateApiToken()) return;

		const log = this.debugLog.bind(this);
		const dryRun = this.settings.dryRunMode;
		try {
			const result = await migrateVault(
				this.app,
				this.settings.todoistApiToken,
				this.settings.defaultDueString,
				0,
				this.settings.excludedFolders,
				false,
				log,
				dryRun,
			);
			if (dryRun) {
				await this.writeDryRunReport(result);
			} else {
				this.showResultNotice(result);
			}
		} catch (e) {
			new Notice(`Migration failed: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	private validateApiToken(): boolean {
		if (!this.settings.todoistApiToken) {
			new Notice("Todoist API token not configured. Go to settings → Todoist migrate.");
			return false;
		}
		return true;
	}

	private startAutoSync() {
		if (!this.settings.autoSyncEnabled) return;
		if (!this.settings.todoistApiToken) return;
		if (this.settings.dryRunMode) return;

		const intervalMs = this.settings.autoSyncIntervalMinutes * 60 * 1000;
		const thresholdMs = this.settings.fileAgeThresholdSeconds * 1000;

		const id = window.setInterval(() => {
			void this.runAutoSync(thresholdMs);
		}, intervalMs);

		this.autoSyncIntervalId = id;
		this.registerInterval(id);
	}

	private async runAutoSync(thresholdMs: number) {
		if (this.autoSyncRunning) return;
		this.autoSyncRunning = true;
		const log = this.debugLog.bind(this);
		try {
			const result = await migrateVault(
				this.app,
				this.settings.todoistApiToken,
				this.settings.defaultDueString,
				thresholdMs,
				this.settings.excludedFolders,
				true,
				log,
			);
			if (result.created > 0 || result.errors.length > 0) {
				this.showResultNotice(result);
			}
		} catch (e) {
			console.error("Todoist auto-sync failed:", e);
		} finally {
			this.autoSyncRunning = false;
		}
	}

	private stopAutoSync() {
		if (this.autoSyncIntervalId !== null) {
			window.clearInterval(this.autoSyncIntervalId);
			this.autoSyncIntervalId = null;
		}
	}

	restartAutoSync() {
		this.stopAutoSync();
		this.startAutoSync();
	}

	private showResultNotice(result: MigrationResult) {
		const parts: string[] = [];
		if (result.created > 0) parts.push(`${result.created} task(s) migrated`);
		if (result.skippedDuplicate > 0) parts.push(`${result.skippedDuplicate} duplicate(s) skipped`);
		if (result.skippedFrontmatter > 0) parts.push(`${result.skippedFrontmatter} file(s) opted out`);
		if (result.skippedTooRecent > 0) parts.push(`${result.skippedTooRecent} file(s) skipped (too recent)`);
		if (result.errors.length > 0) parts.push(`${result.errors.length} error(s)`);

		if (parts.length === 0) {
			new Notice("No todos found to migrate.");
		} else {
			new Notice(parts.join(", "));
		}

		if (result.errors.length > 0) {
			console.error("Todoist migration errors:", result.errors);
		}
	}

	private async writeDryRunReport(result: MigrationResult) {
		const lines: string[] = [
			`# Todoist Migrate — Dry Run Report`,
			``,
			`Generated: ${new Date().toISOString()}`,
			``,
			`## Summary`,
			`- **Would migrate**: ${result.created} task(s)`,
			`- **Duplicates (already in Todoist)**: ${result.skippedDuplicate}`,
			`- **Opted out (todoist: false)**: ${result.skippedFrontmatter}`,
			``,
		];

		if (result.dryRunItems.length > 0) {
			lines.push(`## Tasks that would be migrated`, ``);
			for (const item of result.dryRunItems) {
				lines.push(`- ${item}`);
			}
			lines.push(``);
		}

		lines.push(`> Disable **Dry run mode** in plugin settings to perform the actual migration.`, ``);

		const content = lines.join("\n");
		const reportPath = "todoist-migrate-dry-run.md";
		const existing = this.app.vault.getAbstractFileByPath(reportPath);
		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, content);
		} else {
			await this.app.vault.create(reportPath, content);
		}

		new Notice(`Dry run complete: ${result.created} task(s) would be migrated. See todoist-migrate-dry-run.md`);
	}

	async debugLog(message: string) {
		if (!this.settings.debugLogging) return;
		const timestamp = new Date().toISOString();
		const line = `${timestamp} ${message}\n`;
		const logPath = "todoist-migrate-debug.md";
		const existing = this.app.vault.getAbstractFileByPath(logPath);
		if (existing instanceof TFile) {
			const content = await this.app.vault.read(existing);
			await this.app.vault.modify(existing, content + line);
		} else {
			await this.app.vault.create(logPath, `# Todoist Migrate Debug Log\n\n${line}`);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<TodoistMigrateSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
