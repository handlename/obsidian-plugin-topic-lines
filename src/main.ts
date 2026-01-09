import { Plugin, TAbstractFile, TFile } from "obsidian";
import { DEFAULT_SETTINGS, TopicLineSettings } from "./settings";
import { TopicStore } from "./topic-store";
import { TopicView, VIEW_TYPE_TOPIC_LINES } from "./topic-view";
import { registerCommands } from "./commands";
import { debounce } from "./utils";

export default class TopicLinePlugin extends Plugin {
	settings: TopicLineSettings;
	topicStore: TopicStore;

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
	}

	/**
	 * ファイルイベントを登録する
	 */
	private registerFileEvents(): void {
		// ファイル変更時の内容追従（デバウンス付き）
		const handleModify = debounce(async (file: TAbstractFile) => {
			if (!(file instanceof TFile)) return;

			const topics = this.topicStore.getTopicsByFilePath(file.path);
			if (topics.length === 0) return;

			const content = await this.app.vault.read(file);
			const lines = content.split("\n");

			for (const topic of topics) {
				const startLine = Math.min(topic.startLine, lines.length - 1);
				const endLine = Math.min(topic.endLine, lines.length - 1);
				const newContent = lines
					.slice(startLine, endLine + 1)
					.join("\n");

				if (newContent !== topic.originalContent) {
					await this.topicStore.updateTopicContent(
						topic.id,
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
