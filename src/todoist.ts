import {requestUrl} from "obsidian";
import {TodoistTask} from "./types";

const TODOIST_API_BASE = "https://api.todoist.com/api/v1";

type DebugLogger = (message: string) => Promise<void>;

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
	debugLog?: DebugLogger,
): Promise<TodoistTask> {
	const url = `${TODOIST_API_BASE}/tasks`;
	await debugLog?.(`createTask: POST ${url} content="${content}"`);

	const response = await requestUrl({
		url,
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

	await debugLog?.(`createTask: status=${response.status}`);

	if (response.status < 200 || response.status >= 300) {
		await debugLog?.(`createTask: error body=${response.text}`);
		throw new Error(`Request failed, status ${response.status}`);
	}

	const data = response.json as Record<string, string>;
	await debugLog?.(`createTask: response keys=${Object.keys(data).join(",")}`);
	const id = data["id"] ?? "";
	return {
		id,
		content: data["content"] ?? "",
		description: data["description"] ?? "",
		url: data["url"] ?? `https://app.todoist.com/app/task/${id}`,
	};
}

/**
 * Fetch all active tasks from Todoist for deduplication.
 */
export async function getActiveTasks(apiToken: string, debugLog?: DebugLogger): Promise<TodoistTask[]> {
	const url = `${TODOIST_API_BASE}/tasks`;
	await debugLog?.(`getActiveTasks: GET ${url}`);

	const response = await requestUrl({
		url,
		method: "GET",
		headers: {
			"Authorization": `Bearer ${apiToken}`,
		},
	});

	await debugLog?.(`getActiveTasks: status=${response.status}`);

	if (response.status < 200 || response.status >= 300) {
		await debugLog?.(`getActiveTasks: error body=${response.text}`);
		throw new Error(`Request failed, status ${response.status}`);
	}

	const json = response.json;
	await debugLog?.(`getActiveTasks: response type=${typeof json}, isArray=${Array.isArray(json)}, keys=${typeof json === "object" && json !== null ? Object.keys(json).join(",") : "n/a"}`);

	// v1 API may return { results: [...] } or a plain array
	const tasks: Record<string, string>[] = Array.isArray(json) ? json : (json as Record<string, unknown>)["results"] as Record<string, string>[] ?? [];

	await debugLog?.(`getActiveTasks: parsed ${tasks.length} tasks`);
	return tasks.map((t) => ({
		id: t["id"] ?? "",
		content: t["content"] ?? "",
		description: t["description"] ?? "",
		url: t["url"] ?? "",
	}));
}
