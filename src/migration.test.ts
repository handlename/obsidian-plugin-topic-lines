import { beforeEach, describe, expect, it, vi } from "vitest";
import { isV1Data, isV2Data, migrateV1ToV2 } from "./migration";
import { Topic } from "./types";

function makeTopic(overrides: Partial<Topic> = {}): Topic {
	return {
		id: "id-1",
		filePath: "note.md",
		startLine: 0,
		endLine: 0,
		originalContent: "content",
		createdAt: "2026-01-01T00:00:00.000Z",
		blockId: "topic-abc123",
		lineCount: 1,
		...overrides,
	};
}

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "debug").mockImplementation(() => {});
});

describe("isV1Data", () => {
	it("recognizes explicit version: 1", () => {
		expect(isV1Data({ version: 1, topics: [] })).toBe(true);
	});

	it("recognizes legacy data without version field", () => {
		expect(isV1Data({ topics: [] })).toBe(true);
	});

	it("rejects v2 data", () => {
		expect(isV1Data({ version: 2, slots: [] })).toBe(false);
	});

	it("rejects null and undefined", () => {
		expect(isV1Data(null)).toBe(false);
		expect(isV1Data(undefined)).toBe(false);
	});

	it("rejects empty object", () => {
		expect(isV1Data({})).toBe(false);
	});
});

describe("isV2Data", () => {
	it("recognizes v2 data with slots", () => {
		expect(isV2Data({ version: 2, slots: [] })).toBe(true);
	});

	it("rejects v1 data", () => {
		expect(isV2Data({ version: 1, topics: [] })).toBe(false);
	});

	it("rejects when slots is missing", () => {
		expect(isV2Data({ version: 2 })).toBe(false);
	});

	it("rejects null", () => {
		expect(isV2Data(null)).toBe(false);
	});
});

describe("migrateV1ToV2", () => {
	it("returns default v2 data with 3 empty slots for null input", () => {
		const { data, droppedCount } = migrateV1ToV2(null);
		expect(droppedCount).toBe(0);
		expect(data.version).toBe(2);
		expect(data.slots).toHaveLength(3);
		expect(data.slots.map((s) => s.name)).toEqual(["slot1", "slot2", "slot3"]);
		expect(data.slots.every((s) => s.topic === null)).toBe(true);
	});

	it("returns default v2 data for unrecognizable input", () => {
		const { data, droppedCount } = migrateV1ToV2({ random: "junk" });
		expect(droppedCount).toBe(0);
		expect(data.version).toBe(2);
		expect(data.slots).toHaveLength(3);
	});

	it("migrates 0 topics to 0 slots", () => {
		const { data, droppedCount } = migrateV1ToV2({ version: 1, topics: [] });
		expect(droppedCount).toBe(0);
		expect(data.slots).toEqual([]);
	});

	it("migrates 3 topics to 3 named slots", () => {
		const topics = [makeTopic({ id: "a" }), makeTopic({ id: "b" }), makeTopic({ id: "c" })];
		const { data, droppedCount } = migrateV1ToV2({ version: 1, topics });
		expect(droppedCount).toBe(0);
		expect(data.slots).toHaveLength(3);
		expect(data.slots[0]).toEqual({ name: "slot1", topic: topics[0] });
		expect(data.slots[1]).toEqual({ name: "slot2", topic: topics[1] });
		expect(data.slots[2]).toEqual({ name: "slot3", topic: topics[2] });
	});

	it("migrates exactly 20 topics with no dropping", () => {
		const topics = Array.from({ length: 20 }, (_, i) =>
			makeTopic({ id: `id-${i}` }),
		);
		const { data, droppedCount } = migrateV1ToV2({ version: 1, topics });
		expect(droppedCount).toBe(0);
		expect(data.slots).toHaveLength(20);
		expect(data.slots[19]?.name).toBe("slot20");
	});

	it("drops topics beyond 20 and reports the dropped count", () => {
		const topics = Array.from({ length: 25 }, (_, i) =>
			makeTopic({ id: `id-${i}` }),
		);
		const { data, droppedCount } = migrateV1ToV2({ version: 1, topics });
		expect(droppedCount).toBe(5);
		expect(data.slots).toHaveLength(20);
		expect(data.slots[0]?.topic?.id).toBe("id-0");
		expect(data.slots[19]?.topic?.id).toBe("id-19");
	});

	it("preserves existing settings and adds collisionMode default", () => {
		const raw = {
			version: 1,
			topics: [],
			settings: { frontmatterKeys: ["status"], showFileName: true },
		};
		const { data } = migrateV1ToV2(raw);
		expect(data.settings.frontmatterKeys).toEqual(["status"]);
		expect(data.settings.showFileName).toBe(true);
		expect(data.settings.collisionMode).toBe("confirm");
	});

	it("falls back to default settings when v1 has no settings", () => {
		const { data } = migrateV1ToV2({ version: 1, topics: [] });
		expect(data.settings.frontmatterKeys).toEqual([]);
		expect(data.settings.showFileName).toBe(false);
		expect(data.settings.collisionMode).toBe("confirm");
	});

	it("recognizes legacy data without explicit version", () => {
		const topics = [makeTopic()];
		const { data, droppedCount } = migrateV1ToV2({ topics });
		expect(droppedCount).toBe(0);
		expect(data.slots).toHaveLength(1);
		expect(data.slots[0]?.topic?.id).toBe("id-1");
	});
});
