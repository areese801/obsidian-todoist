import {App, PluginSettingTab, Setting} from "obsidian";
import type TodoistMigratePlugin from "./main";

export interface TodoistMigrateSettings {
	todoistApiToken: string;
	defaultDueString: string;
	autoSyncEnabled: boolean;
	autoSyncIntervalMinutes: number;
	fileAgeThresholdSeconds: number;
	debugLogging: boolean;
}

export const DEFAULT_SETTINGS: TodoistMigrateSettings = {
	todoistApiToken: "",
	defaultDueString: "Today",
	autoSyncEnabled: false,
	autoSyncIntervalMinutes: 5,
	fileAgeThresholdSeconds: 60,
	debugLogging: false,
};

export class TodoistMigrateSettingTab extends PluginSettingTab {
	plugin: TodoistMigratePlugin;

	constructor(app: App, plugin: TodoistMigratePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Todoist migration")
			.setHeading();

		new Setting(containerEl)
			.setName("Todoist API token")
			.setDesc("Get your token from settings → integrations → developer in the Todoist app.")
			.addText(text => text
				.setPlaceholder("Enter your Todoist API token")
				.setValue(this.plugin.settings.todoistApiToken)
				.then(t => t.inputEl.type = "password")
				.onChange(async (value) => {
					this.plugin.settings.todoistApiToken = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Default due date")
			.setDesc("Natural language due date for created tasks (e.g. \"today\", \"tomorrow\", \"next monday\"). Leave empty for no due date.")
			.addText(text => text
				.setPlaceholder("Today")
				.setValue(this.plugin.settings.defaultDueString)
				.onChange(async (value) => {
					this.plugin.settings.defaultDueString = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Auto-sync")
			.setHeading();

		new Setting(containerEl)
			.setName("Enable auto-sync")
			.setDesc("Automatically scan the vault for new todos and migrate them to Todoist on a timer.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSyncEnabled)
				.onChange(async (value) => {
					this.plugin.settings.autoSyncEnabled = value;
					await this.plugin.saveSettings();
					this.plugin.restartAutoSync();
				}));

		new Setting(containerEl)
			.setName("Sync interval (minutes)")
			.setDesc("How often to check for new todos.")
			.addText(text => text
				.setPlaceholder("5")
				.setValue(String(this.plugin.settings.autoSyncIntervalMinutes))
				.onChange(async (value) => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed) && parsed >= 1) {
						this.plugin.settings.autoSyncIntervalMinutes = parsed;
						await this.plugin.saveSettings();
						this.plugin.restartAutoSync();
					}
				}));

		new Setting(containerEl)
			.setName("Debug logging")
			.setDesc("Write debug logs to todoist-migrate-debug.md in the vault root.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugLogging)
				.onChange(async (value) => {
					this.plugin.settings.debugLogging = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("File age threshold (seconds)")
			.setDesc("Skip files modified more recently than this to avoid migrating partially-typed todos. Set to 0 to disable.")
			.addText(text => text
				.setPlaceholder("60")
				.setValue(String(this.plugin.settings.fileAgeThresholdSeconds))
				.onChange(async (value) => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed) && parsed >= 0) {
						this.plugin.settings.fileAgeThresholdSeconds = parsed;
						await this.plugin.saveSettings();
					}
				}));
	}
}
