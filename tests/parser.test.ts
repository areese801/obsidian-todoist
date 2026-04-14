import { describe, it, expect } from "vitest";
import { computeTaskHash, parseTasks, isTodoistEnabled, buildMigratedLine } from "../src/parser";

describe("computeTaskHash", () => {
	it("returns a 64-character hex string (SHA-256)", async () => {
		const hash = await computeTaskHash("Buy milk");
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("is deterministic", async () => {
		const a = await computeTaskHash("Buy milk");
		const b = await computeTaskHash("Buy milk");
		expect(a).toBe(b);
	});

	it("normalizes case", async () => {
		const upper = await computeTaskHash("BUY MILK");
		const lower = await computeTaskHash("buy milk");
		expect(upper).toBe(lower);
	});

	it("strips non-alphanumeric characters", async () => {
		const plain = await computeTaskHash("buymilk");
		const special = await computeTaskHash("buy-milk!");
		expect(plain).toBe(special);
	});

	it("strips whitespace", async () => {
		const tight = await computeTaskHash("buymilk");
		const spaced = await computeTaskHash("  buy  milk  ");
		expect(tight).toBe(spaced);
	});
});

describe("parseTasks", () => {
	it("extracts a simple todo", async () => {
		const tasks = await parseTasks("- [ ] Buy milk");
		expect(tasks).toHaveLength(1);
		expect(tasks[0]!.task).toBe("Buy milk");
		expect(tasks[0]!.lineNumber).toBe(0);
	});

	it("extracts multiple todos", async () => {
		const content = "- [ ] First\n- [ ] Second\n- [ ] Third";
		const tasks = await parseTasks(content);
		expect(tasks).toHaveLength(3);
	});

	it("ignores completed todos", async () => {
		const content = "- [x] Done\n- [ ] Not done";
		const tasks = await parseTasks(content);
		expect(tasks).toHaveLength(1);
		expect(tasks[0]!.task).toBe("Not done");
	});

	it("ignores non-todo lines", async () => {
		const content = "# Heading\nSome text\n- [ ] A task\n- A plain list item";
		const tasks = await parseTasks(content);
		expect(tasks).toHaveLength(1);
	});

	it("handles indented todos", async () => {
		const tasks = await parseTasks("  - [ ] Indented task");
		expect(tasks).toHaveLength(1);
		expect(tasks[0]!.task).toBe("Indented task");
	});

	it("strips # and @ from task text", async () => {
		const tasks = await parseTasks("- [ ] Fix #bug and notify @alice");
		expect(tasks).toHaveLength(1);
		expect(tasks[0]!.task).toBe("Fix bug and notify alice");
	});

	it("returns empty array for no todos", async () => {
		const tasks = await parseTasks("Just a regular note\nWith no todos");
		expect(tasks).toHaveLength(0);
	});

	it("returns empty array for empty string", async () => {
		const tasks = await parseTasks("");
		expect(tasks).toHaveLength(0);
	});

	it("tracks correct line numbers", async () => {
		const content = "# Title\n\n- [ ] First\n\n- [ ] Second";
		const tasks = await parseTasks(content);
		expect(tasks[0]!.lineNumber).toBe(2);
		expect(tasks[1]!.lineNumber).toBe(4);
	});
});

describe("isTodoistEnabled", () => {
	it("returns true when no frontmatter", () => {
		expect(isTodoistEnabled("# Just a heading\nSome content")).toBe(true);
	});

	it("returns true when frontmatter has no todoist key", () => {
		const content = "---\ntitle: My Note\ntags: [foo]\n---\nContent";
		expect(isTodoistEnabled(content)).toBe(true);
	});

	it("returns true when todoist: true", () => {
		const content = "---\ntodoist: true\n---\nContent";
		expect(isTodoistEnabled(content)).toBe(true);
	});

	it("returns false when todoist: false", () => {
		const content = "---\ntodoist: false\n---\nContent";
		expect(isTodoistEnabled(content)).toBe(false);
	});

	it("is case-insensitive for the value", () => {
		const content = "---\ntodoist: False\n---\nContent";
		expect(isTodoistEnabled(content)).toBe(false);
	});

	it("handles todoist key with extra whitespace", () => {
		const content = "---\ntodoist:   false  \n---\nContent";
		expect(isTodoistEnabled(content)).toBe(false);
	});
});

describe("buildMigratedLine", () => {
	it("rewrites a basic todo line", () => {
		const result = buildMigratedLine(
			"- [ ] Buy milk",
			"Buy milk",
			"https://todoist.com/showTask?id=123",
		);
		expect(result).toBe(
			"- [→] ~~Buy milk~~ [(This Task Migrated to Todoist)](https://todoist.com/showTask?id=123)",
		);
	});

	it("preserves indentation", () => {
		const result = buildMigratedLine(
			"  - [ ] Indented task",
			"Indented task",
			"https://todoist.com/showTask?id=456",
		);
		expect(result).toContain("  - [→]");
	});

	it("replaces checkbox space with arrow", () => {
		const result = buildMigratedLine(
			"- [ ] Some task",
			"Some task",
			"https://example.com",
		);
		expect(result).toMatch(/^- \[→\]/);
	});

	it("wraps task text in strikethrough", () => {
		const result = buildMigratedLine(
			"- [ ] My task",
			"My task",
			"https://example.com",
		);
		expect(result).toContain("~~My task~~");
	});

	it("includes Todoist link", () => {
		const url = "https://todoist.com/showTask?id=789";
		const result = buildMigratedLine("- [ ] Task", "Task", url);
		expect(result).toContain(`[(This Task Migrated to Todoist)](${url})`);
	});
});
