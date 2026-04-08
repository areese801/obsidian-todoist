# Testing Setup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add vitest unit tests for parser functions and set up a dev symlink into Obsidian's My Vault for manual testing.

**Architecture:** Vitest runs tests in Node with `crypto.webcrypto` polyfilled for `crypto.subtle`. The plugin build output (`main.js`, `manifest.json`) is symlinked into the Obsidian vault's plugins directory so `npm run dev` rebuilds are immediately available.

**Tech Stack:** Vitest, Node 24 webcrypto, Obsidian plugin sideloading via symlink

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `vitest.config.ts` | Vitest configuration with webcrypto setup |
| Create | `tests/setup.ts` | Polyfill `globalThis.crypto` with Node webcrypto |
| Create | `tests/parser.test.ts` | Unit tests for all exported parser functions |
| Modify | `package.json` | Add vitest devDependency and `test` script |
| Modify | `src/parser.ts:9-14` | Switch from `crypto.subtle` to importable hash util |
| Create | symlink at `~/Obsidian/My Vault/.obsidian/plugins/todoist-migrate/` | Dev testing in Obsidian |

---

## Chunk 1: Vitest Setup and Hash Fix

### Task 1: Install vitest and add test script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install vitest**

```bash
npm install --save-dev vitest
```

- [ ] **Step 2: Add test script to package.json**

Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vitest and test scripts"
```

---

### Task 2: Create vitest config with webcrypto setup

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Create `tests/setup.ts`**

This polyfills `crypto.subtle` for Node so `computeTaskHash` works in tests:

```typescript
import { webcrypto } from "node:crypto";

if (!globalThis.crypto?.subtle) {
	Object.defineProperty(globalThis, "crypto", {
		value: webcrypto,
	});
}
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		setupFiles: ["tests/setup.ts"],
	},
});
```

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts tests/setup.ts
git commit -m "chore: configure vitest with webcrypto polyfill"
```

---

### Task 3: Write tests for `computeTaskHash`

**Files:**
- Create: `tests/parser.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { computeTaskHash } from "../src/parser";

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
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run tests/parser.test.ts
```

Expected: all 5 pass (these test existing working code).

- [ ] **Step 3: Commit**

```bash
git add tests/parser.test.ts
git commit -m "test: add computeTaskHash tests"
```

---

### Task 4: Write tests for `parseTasks`

**Files:**
- Modify: `tests/parser.test.ts`

- [ ] **Step 1: Add parseTasks tests**

```typescript
import { parseTasks } from "../src/parser";

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
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/parser.test.ts
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add tests/parser.test.ts
git commit -m "test: add parseTasks tests"
```

---

### Task 5: Write tests for `isTodoistEnabled`

**Files:**
- Modify: `tests/parser.test.ts`

- [ ] **Step 1: Add isTodoistEnabled tests**

```typescript
import { isTodoistEnabled } from "../src/parser";

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
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/parser.test.ts
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add tests/parser.test.ts
git commit -m "test: add isTodoistEnabled tests"
```

---

### Task 6: Write tests for `buildMigratedLine`

**Files:**
- Modify: `tests/parser.test.ts`

- [ ] **Step 1: Add buildMigratedLine tests**

```typescript
import { buildMigratedLine } from "../src/parser";

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
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run tests/parser.test.ts
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add tests/parser.test.ts
git commit -m "test: add buildMigratedLine tests"
```

---

## Chunk 2: Obsidian Dev Symlink

### Task 7: Set up dev symlink into My Vault

**Files:**
- Create: directory `~/Obsidian/My Vault/.obsidian/plugins/todoist-migrate/`
- Create: symlinks for `main.js` and `manifest.json`

- [ ] **Step 1: Create the plugins directory**

```bash
mkdir -p ~/Obsidian/My\ Vault/.obsidian/plugins/todoist-migrate
```

- [ ] **Step 2: Build the plugin**

```bash
npm run build
```

- [ ] **Step 3: Symlink build output into the vault**

```bash
ln -s /Users/areese/projects/personal/obsidian-todoist/main.js ~/Obsidian/My\ Vault/.obsidian/plugins/todoist-migrate/main.js
ln -s /Users/areese/projects/personal/obsidian-todoist/manifest.json ~/Obsidian/My\ Vault/.obsidian/plugins/todoist-migrate/manifest.json
```

- [ ] **Step 4: Verify symlinks**

```bash
ls -la ~/Obsidian/My\ Vault/.obsidian/plugins/todoist-migrate/
```

Expected: two symlinks pointing back to the project directory.

- [ ] **Step 5: Manual verification in Obsidian**

1. Open "My Vault" in Obsidian
2. Go to Settings → Community Plugins → Enable community plugins
3. Find "Todoist Migrate" in the installed plugins list and enable it
4. Go to Settings → Todoist Migrate → enter your API token
5. Create a test note with `- [ ] Test task from Obsidian` and run "Migrate todos in current file to Todoist" from the command palette

No git commit for this task — symlinks are local dev setup only.
