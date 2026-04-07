import {requestUrl} from "obsidian";
import {TodoistTask} from "./types";

const TODOIST_API_BASE = "https://api.todoist.com/rest/v2";

/**
 * Create a task in Todoist.
 *
 * Returns the created task object with id and url.
 */
export async function createTask(
	apiToken: string,
	content: string,
	description: string,
	dueString: string,
): Promise<TodoistTask> {
	const response = await requestUrl({
		url: `${TODOIST_API_BASE}/tasks`,
		method: "POST",
		headers: {
			"Authorization": `Bearer ${apiToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			content,
			description,
			due_string: dueString || undefined,
		}),
	});

	if (response.status < 200 || response.status >= 300) {
		throw new Error(`Todoist API error: ${response.status} ${response.text}`);
	}

	const data = response.json as Record<string, string>;
	return {
		id: data["id"] ?? "",
		content: data["content"] ?? "",
		description: data["description"] ?? "",
		url: data["url"] ?? "",
	};
}

/**
 * Fetch all active tasks from Todoist for deduplication.
 */
export async function getActiveTasks(apiToken: string): Promise<TodoistTask[]> {
	const response = await requestUrl({
		url: `${TODOIST_API_BASE}/tasks`,
		method: "GET",
		headers: {
			"Authorization": `Bearer ${apiToken}`,
		},
	});

	if (response.status < 200 || response.status >= 300) {
		throw new Error(`Todoist API error: ${response.status} ${response.text}`);
	}

	const tasks = response.json as Record<string, string>[];
	return tasks.map((t) => ({
		id: t["id"] ?? "",
		content: t["content"] ?? "",
		description: t["description"] ?? "",
		url: t["url"] ?? "",
	}));
}
