import { Plugin, TAbstractFile, TFile } from "obsidian";
import { DEFAULT_SETTINGS, TopicLineSettings } from "./settings";
import { TopicLineSettingTab } from "./settings-tab";
import { TopicStore } from "./topic-store";
import { TopicView, VIEW_TYPE_TOPIC_LINES } from "./topic-view";
import { registerCommands } from "./commands";
import { debounce, findLineByBlockId, removeBlockIdFromLine } from "./utils";

export default class TopicLinePlugin extends Plugin {
	settings: TopicLineSettings;
	topicStore: TopicStore;
	private settingsChangeCallbacks: Array<() => void> = [];

	async onload(): Promise<void> {
		await this.loadSettings();

		// TopicStore の初期化
		this.topicStore = new TopicStore(this);
		await this.topicStore.load();

		// ビューの登録
		this.registerView(
			VIEW_TYPE_TOPIC_LINES,
			(leaf) => new TopicView(leaf, this),
		);

		// コマンドの登録
		registerCommands(this);

		// 設定タブの登録
		this.addSettingTab(new TopicLineSettingTab(this.app, this));

		// レイアウト準備完了後にイベント登録
		this.app.workspace.onLayoutReady(() => {
			this.registerFileEvents();
		});
	}

	onunload(): void {
		// クリーンアップは自動的に行われる
	}

	async loadSettings(): Promise<void> {
		const loaded = (await this.loadData()) as
			| { settings?: TopicLineSettings }
			| null
			| undefined;
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			loaded?.settings ?? {},
		);
	}

	async saveSettings(): Promise<void> {
		const data = (await this.loadData()) as Record<string, unknown> | null;
		await this.saveData({ ...data, settings: this.settings });
		this.notifySettingsChange();
	}

	/**
	 * 設定変更通知用コールバックを登録する
	 */
	onSettingsChange(callback: () => void): void {
		this.settingsChangeCallbacks.push(callback);
	}

	/**
	 * 設定変更を通知する
	 */
	private notifySettingsChange(): void {
		for (const callback of this.settingsChangeCallbacks) {
			callback();
		}
	}

	/**
	 * ファイルイベントを登録する
	 */
	private registerFileEvents(): void {
		// ファイル変更時の内容追従（デバウンス付き、ブロックIDベース）
		const handleModify = debounce(async (file: TAbstractFile) => {
			if (!(file instanceof TFile)) return;

			const topics = this.topicStore.getTopicsByFilePath(file.path);
			if (topics.length === 0) return;

			const content = await this.app.vault.read(file);
			const lines = content.split("\n");

			for (const topic of topics) {
				// ブロックIDで現在の行番号を検索
				const currentStartLine = findLineByBlockId(
					lines,
					topic.blockId,
				);

				if (currentStartLine === -1) {
					// ブロックIDが見つからない場合はスキップ（削除された可能性）
					continue;
				}

				// トピックの範囲を計算（lineCountを使用）
				const currentEndLine = Math.min(
					currentStartLine + topic.lineCount - 1,
					lines.length - 1,
				);

				// 新しい内容を取得（ブロックIDを除去して表示用に整形）
				const contentLines = lines.slice(
					currentStartLine,
					currentEndLine + 1,
				);
				const firstLine = contentLines[0];
				if (firstLine !== undefined) {
					contentLines[0] = removeBlockIdFromLine(firstLine);
				}
				const newContent = contentLines.join("\n");

				// 行番号または内容が変わった場合のみ更新
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

		// ファイル削除時（ビューの再描画で警告表示）
		this.registerEvent(
			this.app.vault.on("delete", () => {
				// TopicView が onChange で再描画するため、通知のみ
				this.topicStore["notifyChange"]();
			}),
		);

		// ファイルリネーム時のパス更新
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
