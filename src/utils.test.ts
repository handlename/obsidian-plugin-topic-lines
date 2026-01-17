import { describe, it, expect } from "vitest";
import {
	generateBlockId,
	extractBlockId,
	addBlockIdToLine,
	removeBlockIdFromLine,
	findLineByBlockId,
	dedent,
} from "./utils";

describe("generateBlockId", () => {
	it("should generate block id with topic- prefix", () => {
		const id = generateBlockId();
		expect(id).toMatch(/^topic-[a-z0-9]{6}$/);
	});

	it("should generate unique ids", () => {
		const ids = new Set<string>();
		for (let i = 0; i < 100; i++) {
			ids.add(generateBlockId());
		}
		expect(ids.size).toBe(100);
	});
});

describe("extractBlockId", () => {
	it("should extract block id from line", () => {
		const line = "some text ^block-123";
		expect(extractBlockId(line)).toBe("block-123");
	});

	it("should return null if no block id", () => {
		const line = "some text without block id";
		expect(extractBlockId(line)).toBeNull();
	});

	it("should handle hyphenated block ids", () => {
		const line = "text ^topic-abc123";
		expect(extractBlockId(line)).toBe("topic-abc123");
	});
});

describe("addBlockIdToLine", () => {
	it("should add block id to line without existing id", () => {
		const line = "some text";
		const result = addBlockIdToLine(line, "new-id");
		expect(result).toBe("some text ^new-id");
	});

	it("should replace existing block id", () => {
		const line = "some text ^old-id";
		const result = addBlockIdToLine(line, "new-id");
		expect(result).toBe("some text ^new-id");
	});
});

describe("removeBlockIdFromLine", () => {
	it("should remove block id from line", () => {
		const line = "some text ^block-id";
		const result = removeBlockIdFromLine(line);
		expect(result).toBe("some text");
	});

	it("should return unchanged line if no block id", () => {
		const line = "some text";
		const result = removeBlockIdFromLine(line);
		expect(result).toBe("some text");
	});
});

describe("findLineByBlockId", () => {
	it("should find line index by block id", () => {
		const lines = ["line 1", "line 2 ^target-id", "line 3"];
		const index = findLineByBlockId(lines, "target-id");
		expect(index).toBe(1);
	});

	it("should return -1 if block id not found", () => {
		const lines = ["line 1", "line 2", "line 3"];
		const index = findLineByBlockId(lines, "nonexistent");
		expect(index).toBe(-1);
	});

	it("should handle empty array", () => {
		const index = findLineByBlockId([], "any-id");
		expect(index).toBe(-1);
	});
});

describe("dedent", () => {
	it("should remove common leading indent", () => {
		const text = "    line1\n    line2\n    line3";
		const result = dedent(text);
		expect(result).toBe("line1\nline2\nline3");
	});

	it("should handle mixed indent levels", () => {
		const text = "    base\n        nested\n    back";
		const result = dedent(text);
		expect(result).toBe("base\n    nested\nback");
	});

	it("should preserve empty lines", () => {
		const text = "    line1\n\n    line2";
		const result = dedent(text);
		expect(result).toBe("line1\n\nline2");
	});

	it("should return unchanged text if no common indent", () => {
		const text = "line1\nline2";
		const result = dedent(text);
		expect(result).toBe("line1\nline2");
	});

	it("should handle tabs", () => {
		const text = "\t\tline1\n\t\tline2";
		const result = dedent(text);
		expect(result).toBe("line1\nline2");
	});
});
