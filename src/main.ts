import { Notice, Plugin, TAbstractFile, TFile } from "obsidian";
import { TopicLineSettings } from "./settings";
import { TopicLineSettingTab } from "./settings-tab";
import { TopicStore } from "./topic-store";
import { TopicSidebarView, TOPIC_SIDEBAR_VIEW_TYPE } from "./topic-view";
import {
	refreshPerSlotCommands,
	registerCommands,
	registerPerSlotCommands,
} from "./commands";
import { debounce, findLineByBlockId, removeBlockIdFromLine } from "./utils";

export default class TopicLinePlugin extends Plugin {
	/**
	 * settings は topicStore.data.settings への live reference として保持する。
	 * 直接 mutation した後は必ず saveSettings() を呼ぶこと。
	 */
	settings!: TopicLineSettings;
	topicStore!: TopicStore;
	private settingsChangeCallbacks: Array<() => void> = [];

	/**
	 * 直前に登録された per-slot コマンドの数。
	 * removeCommand 用に保持しておく。
	 */
	private registeredSlotCount = 0;

	async onload(): Promise<void> {
		this.topicStore = new TopicStore(this);
		const loadResult = await this.topicStore.load();

		// settings は topicStore 内の live reference を保持
		this.settings = this.topicStore.getSettings();

		this.registerView(
			TOPIC_SIDEBAR_VIEW_TYPE,
			(leaf) => new TopicSidebarView(leaf, this),
		);

		registerCommands(this);
		registerPerSlotCommands(this);
		this.registeredSlotCount = this.topicStore.getSlotCount();

		this.addSettingTab(new TopicLineSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.registerFileEvents();
		});

		// migration 通知
		if (loadResult.migrated) {
			new Notice("Topics migrated to v2 slot format");
			if (loadResult.droppedCount > 0) {
				new Notice(
					`Migration complete: ${loadResult.droppedCount} topics dropped (exceeds 20-slot limit)`,
				);
			}
		}
	}

	onunload(): void {
		// register* で登録した DOM/Event/Interval は自動クリーンアップされる
	}

	/**
	 * 設定を保存する。
	 * settings は topicStore.data.settings への live reference のため、
	 * mutation 後に store.save() を呼ぶだけで永続化される。
	 */
	async saveSettings(): Promise<void> {
		await this.topicStore.save();
		this.notifySettingsChange();
	}

	/**
	 * slot CRUD（追加・削除・名前変更・並び替え）後に呼ぶ。
	 * 既存の per-slot コマンドを全て removeCommand してから現在の slot 状態で再登録する。
	 */
	refreshSlotCommands(): void {
		refreshPerSlotCommands(this, this.registeredSlotCount);
		this.registeredSlotCount = this.topicStore.getSlotCount();
	}

	onSettingsChange(callback: () => void): void {
		this.settingsChangeCallbacks.push(callback);
	}

	offSettingsChange(callback: () => void): void {
		const index = this.settingsChangeCallbacks.indexOf(callback);
		if (index !== -1) {
			this.settingsChangeCallbacks.splice(index, 1);
		}
	}

	private notifySettingsChange(): void {
		for (const callback of this.settingsChangeCallbacks) {
			callback();
		}
	}

	private registerFileEvents(): void {
		const handleModify = debounce(async (file: TAbstractFile) => {
			if (!(file instanceof TFile)) return;

			const topics = this.topicStore.getTopicsByFilePath(file.path);
			if (topics.length === 0) return;

			const content = await this.app.vault.read(file);
			const lines = content.split("\n");

			for (const topic of topics) {
				const currentStartLine = findLineByBlockId(
					lines,
					topic.blockId,
				);

				if (currentStartLine === -1) continue;

				const currentEndLine = Math.min(
					currentStartLine + topic.lineCount - 1,
					lines.length - 1,
				);

				const contentLines = lines.slice(
					currentStartLine,
					currentEndLine + 1,
				);
				const firstLine = contentLines[0];
				if (firstLine !== undefined) {
					contentLines[0] = removeBlockIdFromLine(firstLine);
				}
				const newContent = contentLines.join("\n");

				if (
					currentStartLine !== topic.startLine ||
					currentEndLine !== topic.endLine ||
					newContent !== topic.originalContent
				) {
					await this.topicStore.updateTopicPosition(
						topic.id,
						currentStartLine,
						currentEndLine,
						newContent,
					);
				}
			}
		}, 300);

		this.registerEvent(this.app.vault.on("modify", handleModify));

		this.registerEvent(
			this.app.vault.on("delete", () => {
				this.topicStore.notifyChange();
			}),
		);

		this.registerEvent(
			this.app.vault.on("rename", async (file, oldPath) => {
				if (!(file instanceof TFile)) return;

				const topics = this.topicStore.getTopicsByFilePath(oldPath);
				for (const topic of topics) {
					await this.topicStore.updateTopicFilePath(
						topic.id,
						file.path,
					);
				}
			}),
		);
	}
}
