import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Plugin } from "obsidian";
import { TopicStore, defaultSlots } from "./topic-store";
import { Topic } from "./types";

interface MockPlugin {
	loadData: ReturnType<typeof vi.fn>;
	saveData: ReturnType<typeof vi.fn>;
}

function makeMockPlugin(initialData: unknown = null): MockPlugin {
	let stored: unknown = initialData;
	return {
		loadData: vi.fn(async () => stored),
		saveData: vi.fn(async (data: unknown) => {
			stored = data;
		}),
	};
}

function topicData(overrides: Partial<Topic> = {}): Omit<
	Topic,
	"id" | "createdAt" | "blockId" | "lineCount"
> {
	return {
		filePath: "note.md",
		startLine: 0,
		endLine: 0,
		originalContent: "content",
		...overrides,
	};
}

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "debug").mockImplementation(() => {});
});

describe("defaultSlots", () => {
	it("returns 3 named empty slots", () => {
		const slots = defaultSlots();
		expect(slots).toHaveLength(3);
		expect(slots.map((s) => s.name)).toEqual(["slot1", "slot2", "slot3"]);
		expect(slots.every((s) => s.topic === null)).toBe(true);
	});
});

describe("TopicStore: initialization", () => {
	it("starts with default slots when no data exists", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		const result = await store.load();
		expect(result).toEqual({ migrated: false, droppedCount: 0 });
		expect(store.getSlotCount()).toBe(3);
		expect(store.getSlots().map((s) => s.name)).toEqual([
			"slot1",
			"slot2",
			"slot3",
		]);
	});

	it("loads v2 data as-is", async () => {
		const v2 = {
			version: 2,
			slots: [
				{ name: "alpha", topic: null },
				{ name: "beta", topic: null },
			],
			settings: {
				frontmatterKeys: ["status"],
				showFileName: true,
				collisionMode: "overwrite" as const,
			},
		};
		const plugin = makeMockPlugin(v2);
		const store = new TopicStore(plugin as unknown as Plugin);
		const result = await store.load();
		expect(result.migrated).toBe(false);
		expect(store.getSlotCount()).toBe(2);
		expect(store.getSettings().collisionMode).toBe("overwrite");
	});

	it("migrates v1 data and reports droppedCount", async () => {
		const topics = Array.from({ length: 25 }, (_, i) => ({
			id: `id-${i}`,
			filePath: "note.md",
			startLine: i,
			endLine: i,
			originalContent: `t${i}`,
			createdAt: "2026-01-01T00:00:00Z",
			blockId: `topic-${i}`,
			lineCount: 1,
		}));
		const plugin = makeMockPlugin({ version: 1, topics });
		const store = new TopicStore(plugin as unknown as Plugin);
		const result = await store.load();
		expect(result.migrated).toBe(true);
		expect(result.droppedCount).toBe(5);
		expect(store.getSlotCount()).toBe(20);
		expect(plugin.saveData).toHaveBeenCalled();
	});
});

describe("TopicStore: setTopicToSlot", () => {
	it("creates a topic in an empty slot", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		const result = await store.setTopicToSlot(0, topicData());
		expect(result).not.toBeNull();
		expect(result?.replaced).toBeNull();
		expect(result?.topic.id).toMatch(/^[0-9a-f-]+$/);
		expect(store.getSlotByIndex(0)?.topic?.id).toBe(result?.topic.id);
	});

	it("returns the replaced topic when slot is occupied", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		const first = await store.setTopicToSlot(0, topicData());
		const second = await store.setTopicToSlot(
			0,
			topicData({ originalContent: "new" }),
		);
		expect(second?.replaced?.id).toBe(first?.topic.id);
		expect(store.getSlotByIndex(0)?.topic?.originalContent).toBe("new");
	});

	it("returns null for out-of-bounds index", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		expect(await store.setTopicToSlot(99, topicData())).toBeNull();
	});
});

describe("TopicStore: clearSlot", () => {
	it("clears occupied slot and returns the topic", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		const set = await store.setTopicToSlot(1, topicData());
		const removed = await store.clearSlot(1);
		expect(removed?.id).toBe(set?.topic.id);
		expect(store.getSlotByIndex(1)?.topic).toBeNull();
	});

	it("returns null for empty slot", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		expect(await store.clearSlot(0)).toBeNull();
	});
});

describe("TopicStore: clearAllSlots", () => {
	it("returns all topics that were cleared and leaves slots in place", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		await store.setTopicToSlot(0, topicData());
		await store.setTopicToSlot(2, topicData({ originalContent: "x" }));
		const removed = await store.clearAllSlots();
		expect(removed).toHaveLength(2);
		expect(store.getSlotCount()).toBe(3);
		expect(store.getSlots().every((s) => s.topic === null)).toBe(true);
	});
});

describe("TopicStore: findFirstEmptySlotIndex", () => {
	it("returns first empty index when slots are mixed", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		await store.setTopicToSlot(0, topicData());
		expect(store.findFirstEmptySlotIndex()).toBe(1);
	});

	it("returns -1 when all slots are full", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		await store.setTopicToSlot(0, topicData());
		await store.setTopicToSlot(1, topicData());
		await store.setTopicToSlot(2, topicData());
		expect(store.findFirstEmptySlotIndex()).toBe(-1);
	});
});

describe("TopicStore: findTopicSlotIndex", () => {
	it("returns slot index containing the topic", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		const set = await store.setTopicToSlot(2, topicData());
		expect(store.findTopicSlotIndex(set!.topic.id)).toBe(2);
	});

	it("returns -1 when topic not found", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		expect(store.findTopicSlotIndex("missing")).toBe(-1);
	});
});

describe("TopicStore: addSlot / removeSlot / renameSlot / reorderSlots", () => {
	it("adds slot under limit", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		expect(await store.addSlot("new")).toBe(true);
		expect(store.getSlotCount()).toBe(4);
		expect(store.getSlotByIndex(3)?.name).toBe("new");
	});

	it("rejects empty slot name", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		expect(await store.addSlot("   ")).toBe(false);
		expect(store.getSlotCount()).toBe(3);
	});

	it("rejects slot name exceeding 50 chars", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		expect(await store.addSlot("x".repeat(51))).toBe(false);
	});

	it("rejects addSlot at limit (20)", async () => {
		const slots = Array.from({ length: 20 }, (_, i) => ({
			name: `s${i}`,
			topic: null,
		}));
		const plugin = makeMockPlugin({
			version: 2,
			slots,
			settings: {
				frontmatterKeys: [],
				showFileName: false,
				collisionMode: "confirm",
			},
		});
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		expect(await store.addSlot("x")).toBe(false);
		expect(store.getSlotCount()).toBe(20);
	});

	it("removes slot and returns its topic", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		const set = await store.setTopicToSlot(1, topicData());
		const removed = await store.removeSlot(1);
		expect(removed?.id).toBe(set?.topic.id);
		expect(store.getSlotCount()).toBe(2);
	});

	it("rejects removeSlot at minimum (1 slot)", async () => {
		const plugin = makeMockPlugin({
			version: 2,
			slots: [{ name: "only", topic: null }],
			settings: {
				frontmatterKeys: [],
				showFileName: false,
				collisionMode: "confirm",
			},
		});
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		expect(await store.removeSlot(0)).toBeNull();
		expect(store.getSlotCount()).toBe(1);
	});

	it("renames slot", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		expect(await store.renameSlot(0, "renamed")).toBe(true);
		expect(store.getSlotByIndex(0)?.name).toBe("renamed");
	});

	it("rejects empty rename", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		expect(await store.renameSlot(0, "  ")).toBe(false);
	});

	it("reorders slots", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		await store.reorderSlots(0, 2);
		expect(store.getSlots().map((s) => s.name)).toEqual([
			"slot2",
			"slot3",
			"slot1",
		]);
	});

	it("ignores reorder out of bounds", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		await store.reorderSlots(0, 99);
		expect(store.getSlots().map((s) => s.name)).toEqual([
			"slot1",
			"slot2",
			"slot3",
		]);
	});
});

describe("TopicStore: getTopicsByFilePath", () => {
	it("finds topics across multiple slots", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		await store.setTopicToSlot(0, topicData({ filePath: "a.md" }));
		await store.setTopicToSlot(1, topicData({ filePath: "b.md" }));
		await store.setTopicToSlot(2, topicData({ filePath: "a.md" }));
		expect(store.getTopicsByFilePath("a.md")).toHaveLength(2);
		expect(store.getTopicsByFilePath("c.md")).toHaveLength(0);
	});
});

describe("TopicStore: getSettings live reference", () => {
	it("returns the same object reference across calls", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		const a = store.getSettings();
		const b = store.getSettings();
		expect(a).toBe(b);
	});

	it("mutations to the returned settings are visible without re-fetch", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		const settings = store.getSettings();
		settings.showFileName = true;
		expect(store.getSettings().showFileName).toBe(true);
	});
});

describe("TopicStore: notifyChange", () => {
	it("invokes registered callbacks", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		const cb = vi.fn();
		store.onChange(cb);
		await store.setTopicToSlot(0, topicData());
		expect(cb).toHaveBeenCalled();
	});

	it("offChange detaches callbacks", async () => {
		const plugin = makeMockPlugin();
		const store = new TopicStore(plugin as unknown as Plugin);
		await store.load();
		const cb = vi.fn();
		store.onChange(cb);
		store.offChange(cb);
		await store.setTopicToSlot(0, topicData());
		expect(cb).not.toHaveBeenCalled();
	});
});
