import { Plugin } from "obsidian";
import { Topic, TopicData } from "./types";
import { generateUUID, generateBlockId } from "./utils";

/** トピック数の上限 */
const MAX_TOPICS = 20;

/**
 * トピックデータの管理（CRUD）と永続化を担うクラス
 */
export class TopicStore {
	private plugin: Plugin;
	private data: TopicData;
	private changeCallbacks: Array<() => void> = [];

	constructor(plugin: Plugin) {
		this.plugin = plugin;
		this.data = { version: 1, topics: [] };
	}

	/**
	 * トピック一覧を取得する
	 */
	getTopics(): Topic[] {
		return [...this.data.topics];
	}

	/**
	 * インデックスでトピックを取得する（0-indexed）
	 */
	getTopicByIndex(index: number): Topic | null {
		return this.data.topics[index] ?? null;
	}

	/**
	 * トピックを追加する（最大20件制限）
	 * @returns 追加されたトピック、または上限超過時はnull
	 */
	async addTopic(
		topicData: Omit<Topic, "id" | "createdAt" | "blockId" | "lineCount">,
	): Promise<Topic | null> {
		if (this.data.topics.length >= MAX_TOPICS) {
			return null;
		}

		const lineCount = topicData.endLine - topicData.startLine + 1;
		const topic: Topic = {
			...topicData,
			id: generateUUID(),
			createdAt: new Date().toISOString(),
			blockId: generateBlockId(),
			lineCount,
		};

		this.data.topics.push(topic);
		await this.save();
		this.notifyChange();

		return topic;
	}

	/**
	 * トピックを削除する
	 */
	async removeTopic(id: string): Promise<void> {
		const index = this.data.topics.findIndex((t) => t.id === id);
		if (index !== -1) {
			this.data.topics.splice(index, 1);
			await this.save();
			this.notifyChange();
		}
	}

	/**
	 * すべてのトピックを削除する
	 * @returns 削除されたトピックの配列
	 */
	async clearAllTopics(): Promise<Topic[]> {
		const removedTopics = [...this.data.topics];
		this.data.topics = [];
		await this.save();
		this.notifyChange();
		return removedTopics;
	}

	/**
	 * トピックを並び替える
	 */
	async reorderTopics(fromIndex: number, toIndex: number): Promise<void> {
		if (
			fromIndex < 0 ||
			fromIndex >= this.data.topics.length ||
			toIndex < 0 ||
			toIndex >= this.data.topics.length
		) {
			return;
		}

		const removed = this.data.topics[fromIndex];
		if (!removed) {
			return;
		}
		this.data.topics.splice(fromIndex, 1);
		this.data.topics.splice(toIndex, 0, removed);
		await this.save();
		this.notifyChange();
	}

	/**
	 * トピックの内容を更新する（元ノート変更時）
	 */
	async updateTopicContent(id: string, content: string): Promise<void> {
		const topic = this.data.topics.find((t) => t.id === id);
		if (topic) {
			topic.originalContent = content;
			await this.save();
			this.notifyChange();
		}
	}

	/**
	 * トピックの行番号と内容を更新する（ブロックID追跡結果反映用）
	 */
	async updateTopicPosition(
		id: string,
		startLine: number,
		endLine: number,
		content: string,
	): Promise<void> {
		const topic = this.data.topics.find((t) => t.id === id);
		if (topic) {
			topic.startLine = startLine;
			topic.endLine = endLine;
			topic.originalContent = content;
			await this.save();
			this.notifyChange();
		}
	}

	/**
	 * トピックのファイルパスを更新する（元ノートリネーム時）
	 */
	async updateTopicFilePath(id: string, newPath: string): Promise<void> {
		const topic = this.data.topics.find((t) => t.id === id);
		if (topic) {
			topic.filePath = newPath;
			await this.save();
			this.notifyChange();
		}
	}

	/**
	 * 指定ファイルパスを持つトピック一覧を取得する
	 */
	getTopicsByFilePath(filePath: string): Topic[] {
		return this.data.topics.filter((t) => t.filePath === filePath);
	}

	/**
	 * データを読み込む
	 */
	async load(): Promise<void> {
		const loaded = (await this.plugin.loadData()) as {
			version?: number;
			topics?: Topic[];
		} | null;
		if (loaded && typeof loaded === "object") {
			this.data = {
				version: 1,
				topics: loaded.topics ?? [],
			};
		} else {
			this.data = { version: 1, topics: [] };
		}
	}

	/**
	 * データを保存する
	 * 既存の他のデータ（settingsなど）を保持しつつトピックデータを更新する
	 */
	async save(): Promise<void> {
		const existingData =
			((await this.plugin.loadData()) as Record<string, unknown>) ?? {};
		await this.plugin.saveData({
			...existingData,
			version: this.data.version,
			topics: this.data.topics,
		});
	}

	/**
	 * 変更通知用コールバックを登録する
	 */
	onChange(callback: () => void): void {
		this.changeCallbacks.push(callback);
	}

	/**
	 * 変更通知用コールバックを解除する
	 */
	offChange(callback: () => void): void {
		const index = this.changeCallbacks.indexOf(callback);
		if (index !== -1) {
			this.changeCallbacks.splice(index, 1);
		}
	}

	/**
	 * 変更を通知する
	 */
	private notifyChange(): void {
		for (const callback of this.changeCallbacks) {
			callback();
		}
	}
}
