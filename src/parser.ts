import {ParsedTask} from "./types";

const TODO_REGEX = /^(\s*- \[ ]\s+)(.*$)/;

/**
 * Compute an MD5-style hash for deduplication.
 * Mirrors the Python project: lowercase, strip non-alphanumeric, then hash.
 */
export async function computeTaskHash(taskDescription: string): Promise<string> {
	const normalized = taskDescription.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
	const data = new TextEncoder().encode(normalized);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Clean task text by stripping # and @ characters.
 * These have special meaning in Todoist (project and label) and would
 * cause unintended categorization.
 */
function cleanTaskText(text: string): string {
	return text.replace(/[#@]/g, "");
}

/**
 * Parse all incomplete TODO items from markdown content.
 * Matches lines like: `- [ ] Some task here`
 */
export async function parseTasks(content: string): Promise<ParsedTask[]> {
	const lines = content.split("\n");
	const tasks: ParsedTask[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const match = line.match(TODO_REGEX);
		if (!match || !match[1] || !match[2]) continue;

		const markdownPart: string = match[1];
		const rawTask: string = match[2];
		const task = cleanTaskText(rawTask);
		const taskMd5Hash = await computeTaskHash(task);

		tasks.push({
			markdownPart,
			task,
			taskMd5Hash,
			originalString: line,
			lineNumber: i,
		});
	}

	return tasks;
}

/**
 * Check if a file's frontmatter opts out of Todoist migration.
 * Returns false only if frontmatter contains `todoist: false`.
 */
export function isTodoistEnabled(content: string): boolean {
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!fmMatch) return true;

	const fmBlock = fmMatch[1] ?? "";
	const todoistMatch = fmBlock.match(/^todoist:\s*(.+)$/m);
	if (!todoistMatch || !todoistMatch[1]) return true;

	const value = todoistMatch[1].trim().toLowerCase();
	return value !== "false";
}

/**
 * Rewrite a single task line to the migrated format.
 *
 * Before: `- [ ] Buy Milk`
 * After:  `- [→] ~~Buy Milk~~ [(This task migrated to Todoist)](https://todoist.com/showTask?id=123)`
 */
export function buildMigratedLine(originalLine: string, taskText: string, todoistUrl: string): string {
	// Replace the space in [ ] with →
	const withArrow = originalLine.replace(/^(\s*- \[) (\].*)/, "$1→$2");
	// Replace the task text with strikethrough + Todoist link
	const taskStart = withArrow.indexOf("] ") + 2;
	const prefix = withArrow.substring(0, taskStart);
	return `${prefix}~~${taskText}~~ [(This Task Migrated to Todoist)](${todoistUrl})`;
}
