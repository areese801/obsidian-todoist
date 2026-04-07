import {App, PluginSettingTab, Setting} from "obsidian";
import type TodoistMigratePlugin from "./main";

export interface TodoistMigrateSettings {
	todoistApiToken: string;
	defaultDueString: string;
}

export const DEFAULT_SETTINGS: TodoistMigrateSettings = {
	todoistApiToken: "",
	defaultDueString: "Today",
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
	}
}
