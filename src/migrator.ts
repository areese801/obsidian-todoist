import {App, TFile, Notice} from "obsidian";
import {parseTasks, isTodoistEnabled, buildMigratedLine, computeTaskHash} from "./parser";
import {createTask, getActiveTasks} from "./todoist";
import {MigrationResult, TodoistTask} from "./types";

/**
 * Migrate TODO items from a single file to Todoist.
 */
export async function migrateFile(
	app: App,
	file: TFile,
	apiToken: string,
	dueString: string,
	existingTasks: TodoistTask[],
	existingHashes: Set<string>,
): Promise<MigrationResult> {
	const result: MigrationResult = {created: 0, skippedDuplicate: 0, skippedFrontmatter: 0, skippedTooRecent: 0, errors: []};

	let content = await app.vault.read(file);

	if (!isTodoistEnabled(content)) {
		result.skippedFrontmatter = 1;
		return result;
	}

	const tasks = await parseTasks(content);
	if (tasks.length === 0) return result;

	const vaultName = app.vault.getName();
	const noteName = file.path.replace(/\.md$/, "");
	const obsidianUri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(noteName)}`;

	// Process tasks in reverse order so line numbers stay valid as we modify content
	const sortedTasks = [...tasks].sort((a, b) => b.lineNumber - a.lineNumber);

	for (const task of sortedTasks) {
		// Deduplication check
		if (existingHashes.has(task.taskMd5Hash)) {
			result.skippedDuplicate++;
			continue;
		}

		try {
			const description = `Migrated from [${file.name}](${obsidianUri}). (Link may break if file was renamed or moved.)`;

			const todoistTask = await createTask(
				apiToken,
				task.task,
				description,
				dueString,
			);

			// Rewrite the line in the file content
			const lines = content.split("\n");
			lines[task.lineNumber] = buildMigratedLine(
				task.originalString,
				task.task,
				todoistTask.url,
			);
			content = lines.join("\n");

			// Add to existing hashes so subsequent tasks in same file are deduped
			existingHashes.add(task.taskMd5Hash);
			result.created++;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			result.errors.push(`"${task.task}": ${msg}`);
		}
	}

	// Write modified content back if any tasks were migrated
	if (result.created > 0) {
		await app.vault.modify(file, content);
	}

	return result;
}

/**
 * Migrate TODOs from the active file to Todoist.
 */
export async function migrateActiveFile(
	app: App,
	apiToken: string,
	dueString: string,
): Promise<MigrationResult> {
	const file = app.workspace.getActiveFile();
	if (!file || file.extension !== "md") {
		return {created: 0, skippedDuplicate: 0, skippedFrontmatter: 0, skippedTooRecent: 0, errors: ["No active markdown file"]};
	}

	new Notice("Fetching existing Todoist tasks\u2026");
	const existingTasks = await getActiveTasks(apiToken);
	const existingHashes = await buildHashSet(existingTasks);

	return migrateFile(app, file, apiToken, dueString, existingTasks, existingHashes);
}

/**
 * Migrate TODOs from all markdown files in the vault to Todoist.
 */
export async function migrateVault(
	app: App,
	apiToken: string,
	dueString: string,
	fileAgeThresholdMs: number = 0,
	silent: boolean = false,
): Promise<MigrationResult> {
	const totals: MigrationResult = {created: 0, skippedDuplicate: 0, skippedFrontmatter: 0, skippedTooRecent: 0, errors: []};

	if (!silent) {
		new Notice("Fetching existing Todoist tasks\u2026");
	}
	const existingTasks = await getActiveTasks(apiToken);
	const existingHashes = await buildHashSet(existingTasks);

	const files = app.vault.getMarkdownFiles();
	let processed = 0;

	for (const file of files) {
		if (fileAgeThresholdMs > 0) {
			const age = Date.now() - file.stat.mtime;
			if (age < fileAgeThresholdMs) {
				totals.skippedTooRecent++;
				continue;
			}
		}

		const result = await migrateFile(app, file, apiToken, dueString, existingTasks, existingHashes);
		totals.created += result.created;
		totals.skippedDuplicate += result.skippedDuplicate;
		totals.skippedFrontmatter += result.skippedFrontmatter;
		totals.skippedTooRecent += result.skippedTooRecent;
		totals.errors.push(...result.errors);
		processed++;

		if (!silent && processed % 50 === 0) {
			new Notice(`Processing... ${processed}/${files.length} files`);
		}
	}

	return totals;
}

async function buildHashSet(tasks: TodoistTask[]): Promise<Set<string>> {
	const hashes = new Set<string>();
	for (const task of tasks) {
		const hash = await computeTaskHash(task.content);
		hashes.add(hash);
	}
	return hashes;
}
