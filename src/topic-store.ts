import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, TopicLineSettings } from "./settings";
import {
	DEFAULT_SLOT_COUNT,
	DEFAULT_SLOT_NAMES,
	SLOT_LIMIT,
	SLOT_MIN,
	SLOT_NAME_MAX_LENGTH,
	Slot,
	Topic,
	TopicDataV2,
} from "./types";
import { generateBlockId, generateUUID } from "./utils";
import { isV1Data, isV2Data, migrateV1ToV2 } from "./migration";

/**
 * デフォルトの slot 配列（fresh start 用）。
 */
export function defaultSlots(): Slot[] {
	const slots: Slot[] = [];
	for (let i = 0; i < DEFAULT_SLOT_COUNT; i++) {
		slots.push({
			name: DEFAULT_SLOT_NAMES[i] ?? `slot${i + 1}`,
			topic: null,
		});
	}
	return slots;
}

/**
 * Slot ベースのデータ管理（CRUD）と永続化を担うクラス（v2）。
 */
export class TopicStore {
	private plugin: Plugin;
	private data: TopicDataV2;
	private changeCallbacks: Array<() => void> = [];

	constructor(plugin: Plugin) {
		this.plugin = plugin;
		this.data = {
			version: 2,
			slots: defaultSlots(),
			settings: { ...DEFAULT_SETTINGS },
		};
	}

	// ---- スロット参照 API ----

	/**
	 * スロット一覧を返す（slot と内部 topic は浅いコピーで返却）。
	 * 呼び出し側のミューテーションが内部状態に波及することを防ぐため、
	 * topic オブジェクトもコピーする。
	 */
	getSlots(): Slot[] {
		return this.data.slots.map((slot) => ({
			name: slot.name,
			topic: slot.topic ? { ...slot.topic } : null,
		}));
	}

	/**
	 * インデックス指定でスロットを取得する。範囲外なら null。
	 */
	getSlotByIndex(index: number): Slot | null {
		return this.data.slots[index] ?? null;
	}

	/** スロット数 */
	getSlotCount(): number {
		return this.data.slots.length;
	}

	/**
	 * 指定 topicId を保持する slot のインデックスを返す。見つからなければ -1。
	 */
	findTopicSlotIndex(topicId: string): number {
		return this.data.slots.findIndex((slot) => slot.topic?.id === topicId);
	}

	/**
	 * 並び順で最初の空 slot のインデックスを返す。全て埋まっていれば -1。
	 */
	findFirstEmptySlotIndex(): number {
		return this.data.slots.findIndex((slot) => slot.topic === null);
	}

	// ---- topic 設定 API ----

	/**
	 * 指定 slot に topic をセットする。slot が既に占有されていれば古い topic を返す
	 * （呼び出し側で block ID クリーンアップを行うため）。新しい topic を返す。
	 */
	async setTopicToSlot(
		index: number,
		topicData: Omit<Topic, "id" | "createdAt" | "blockId" | "lineCount">,
	): Promise<{ topic: Topic; replaced: Topic | null } | null> {
		const slot = this.data.slots[index];
		if (!slot) return null;

		const lineCount = topicData.endLine - topicData.startLine + 1;
		const topic: Topic = {
			...topicData,
			id: generateUUID(),
			createdAt: new Date().toISOString(),
			blockId: generateBlockId(),
			lineCount,
		};

		const replaced = slot.topic;
		slot.topic = topic;
		await this.save();
		this.notifyChange();
		return { topic, replaced };
	}

	/**
	 * 指定 slot を空にする。空いていた場合は null、占有されていた場合は外された topic を返す。
	 */
	async clearSlot(index: number): Promise<Topic | null> {
		const slot = this.data.slots[index];
		if (!slot) return null;
		const removed = slot.topic;
		if (removed === null) return null;
		slot.topic = null;
		await this.save();
		this.notifyChange();
		return removed;
	}

	/**
	 * すべての slot を空にする。除去された topic 配列を返す。
	 */
	async clearAllSlots(): Promise<Topic[]> {
		const removed: Topic[] = [];
		for (const slot of this.data.slots) {
			if (slot.topic) {
				removed.push(slot.topic);
				slot.topic = null;
			}
		}
		await this.save();
		this.notifyChange();
		return removed;
	}

	// ---- スロット CRUD ----

	/**
	 * 新規スロットを末尾に追加する。上限到達時は false を返す。
	 */
	async addSlot(name: string): Promise<boolean> {
		if (this.data.slots.length >= SLOT_LIMIT) return false;
		const trimmed = name.trim();
		if (trimmed.length === 0) return false;
		if (trimmed.length > SLOT_NAME_MAX_LENGTH) return false;

		this.data.slots.push({ name: trimmed, topic: null });
		await this.save();
		this.notifyChange();
		return true;
	}

	/**
	 * 指定 slot を削除する。下限 (SLOT_MIN) 到達時、または範囲外の場合は null を返す。
	 * 占有されていた topic は cleanup のために返す。
	 */
	async removeSlot(index: number): Promise<Topic | null> {
		if (this.data.slots.length <= SLOT_MIN) return null;
		const slot = this.data.slots[index];
		if (!slot) return null;
		const removedTopic = slot.topic;
		this.data.slots.splice(index, 1);
		await this.save();
		this.notifyChange();
		return removedTopic;
	}

	/**
	 * スロット名を変更する。空文字 / 長すぎる場合は false を返す。
	 */
	async renameSlot(index: number, name: string): Promise<boolean> {
		const slot = this.data.slots[index];
		if (!slot) return false;
		const trimmed = name.trim();
		if (trimmed.length === 0) return false;
		if (trimmed.length > SLOT_NAME_MAX_LENGTH) return false;
		slot.name = trimmed;
		await this.save();
		this.notifyChange();
		return true;
	}

	/**
	 * スロットを並び替える。範囲外なら何もしない。
	 */
	async reorderSlots(fromIndex: number, toIndex: number): Promise<void> {
		if (
			fromIndex < 0 ||
			fromIndex >= this.data.slots.length ||
			toIndex < 0 ||
			toIndex >= this.data.slots.length ||
			fromIndex === toIndex
		) {
			return;
		}
		const [moved] = this.data.slots.splice(fromIndex, 1);
		if (!moved) return;
		this.data.slots.splice(toIndex, 0, moved);
		await this.save();
		this.notifyChange();
	}

	// ---- 設定参照 ----

	/**
	 * settings を返す（live reference）。呼び出し側は in-place mutation できる。
	 * mutation 後は plugin.saveSettings() を必ず呼ぶこと。
	 */
	getSettings(): TopicLineSettings {
		return this.data.settings;
	}

	// ---- topic 内容更新（ファイルイベント駆動） ----

	/**
	 * topic の表示用 content を更新する。
	 */
	async updateTopicContent(id: string, content: string): Promise<void> {
		const topic = this.findTopic(id);
		if (topic) {
			topic.originalContent = content;
			await this.save();
			this.notifyChange();
		}
	}

	/**
	 * topic の行番号と内容を更新する（ブロックID追跡結果反映用）。
	 */
	async updateTopicPosition(
		id: string,
		startLine: number,
		endLine: number,
		content: string,
	): Promise<void> {
		const topic = this.findTopic(id);
		if (topic) {
			topic.startLine = startLine;
			topic.endLine = endLine;
			topic.originalContent = content;
			await this.save();
			this.notifyChange();
		}
	}

	/**
	 * topic のファイルパスを更新する（リネーム対応）。
	 */
	async updateTopicFilePath(id: string, newPath: string): Promise<void> {
		const topic = this.findTopic(id);
		if (topic) {
			topic.filePath = newPath;
			await this.save();
			this.notifyChange();
		}
	}

	/**
	 * 指定ファイルパスを持つ topic 一覧を返す。
	 */
	getTopicsByFilePath(filePath: string): Topic[] {
		const result: Topic[] = [];
		for (const slot of this.data.slots) {
			if (slot.topic && slot.topic.filePath === filePath) {
				result.push(slot.topic);
			}
		}
		return result;
	}

	// ---- 永続化 ----

	/**
	 * loadData() の結果を解釈する。v1 → v2 マイグレーションを内蔵。
	 * 戻り値は今回のロードでマイグレーションにより破棄された topic 数。
	 */
	async load(): Promise<{ migrated: boolean; droppedCount: number }> {
		const raw = (await this.plugin.loadData()) as unknown;
		if (isV2Data(raw)) {
			this.data = this.normalizeV2(raw);
			return { migrated: false, droppedCount: 0 };
		}
		if (isV1Data(raw)) {
			const { data, droppedCount } = migrateV1ToV2(raw);
			this.data = data;
			await this.save();
			return { migrated: true, droppedCount };
		}
		this.data = {
			version: 2,
			slots: defaultSlots(),
			settings: { ...DEFAULT_SETTINGS },
		};
		await this.save();
		return { migrated: false, droppedCount: 0 };
	}

	/**
	 * 永続化する（v2 形式の TopicDataV2 をそのまま saveData する）。
	 */
	async save(): Promise<void> {
		await this.plugin.saveData(this.data);
	}

	// ---- 変更通知 ----

	onChange(callback: () => void): void {
		this.changeCallbacks.push(callback);
	}

	offChange(callback: () => void): void {
		const index = this.changeCallbacks.indexOf(callback);
		if (index !== -1) {
			this.changeCallbacks.splice(index, 1);
		}
	}

	notifyChange(): void {
		for (const callback of this.changeCallbacks) {
			callback();
		}
	}

	// ---- 内部ヘルパ ----

	private findTopic(id: string): Topic | null {
		for (const slot of this.data.slots) {
			if (slot.topic?.id === id) return slot.topic;
		}
		return null;
	}

	/**
	 * v2 データを正規化する（settings の不足フィールドをデフォルトで補う）。
	 */
	private normalizeV2(raw: TopicDataV2): TopicDataV2 {
		return {
			version: 2,
			slots: Array.isArray(raw.slots) ? raw.slots : defaultSlots(),
			settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
		};
	}
}
