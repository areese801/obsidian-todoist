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
