import {Notice, Plugin} from "obsidian";
import {DEFAULT_SETTINGS, TodoistMigrateSettings, TodoistMigrateSettingTab} from "./settings";
import {migrateActiveFile, migrateVault} from "./migrator";
import {MigrationResult} from "./types";

export default class TodoistMigratePlugin extends Plugin {
	settings: TodoistMigrateSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon("check-square", "Migrate todos to Todoist", async () => {
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
	}

	private async runMigrateActiveFile() {
		if (!this.validateApiToken()) return;

		try {
			const result = await migrateActiveFile(
				this.app,
				this.settings.todoistApiToken,
				this.settings.defaultDueString,
			);
			this.showResultNotice(result);
		} catch (e) {
			new Notice(`Migration failed: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	private async runMigrateVault() {
		if (!this.validateApiToken()) return;

		try {
			const result = await migrateVault(
				this.app,
				this.settings.todoistApiToken,
				this.settings.defaultDueString,
			);
			this.showResultNotice(result);
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

	private showResultNotice(result: MigrationResult) {
		const parts: string[] = [];
		if (result.created > 0) parts.push(`${result.created} task(s) migrated`);
		if (result.skippedDuplicate > 0) parts.push(`${result.skippedDuplicate} duplicate(s) skipped`);
		if (result.skippedFrontmatter > 0) parts.push(`${result.skippedFrontmatter} file(s) opted out`);
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

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<TodoistMigrateSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
