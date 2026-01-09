import {
	Component,
	ItemView,
	MarkdownRenderer,
	MarkdownView,
	TFile,
	WorkspaceLeaf,
} from "obsidian";
import type TopicLinePlugin from "./main";
import { Topic } from "./types";
import { removeBlockIdFromFile } from "./commands";
import { getFrontmatterValues } from "./frontmatter";

export const VIEW_TYPE_TOPIC_LINES = "topic-lines-view";

/**
 * サイドバーにトピック一覧を表示するビュー
 */
export class TopicView extends ItemView {
	private plugin: TopicLinePlugin;
	private renderComponent: Component;

	constructor(leaf: WorkspaceLeaf, plugin: TopicLinePlugin) {
		super(leaf);
		this.plugin = plugin;
		this.renderComponent = new Component();
	}

	getViewType(): string {
		return VIEW_TYPE_TOPIC_LINES;
	}

	getDisplayText(): string {
		return "Topic lines";
	}

	getIcon(): string {
		return "list";
	}

	async onOpen(): Promise<void> {
		this.render();
		this.plugin.topicStore.onChange(() => this.render());
		this.plugin.onSettingsChange(() => this.render());
	}

	async onClose(): Promise<void> {
		this.renderComponent.unload();
	}

	/**
	 * ビューを再描画する
	 */
	render(): void {
		const container = this.containerEl.children[1] as
			| HTMLElement
			| undefined;
		if (!container) {
			return;
		}
		container.empty();

		const topicContainer = container.createDiv({
			cls: "topic-lines-container",
		});

		const topics = this.plugin.topicStore.getTopics();

		if (topics.length === 0) {
			topicContainer.createDiv({
				cls: "topic-lines-empty",
				text: "No topics registered",
			});
			return;
		}

		for (const [i, topic] of topics.entries()) {
			this.renderTopicItem(topicContainer, topic, i);
		}
	}

	/**
	 * 個別トピックアイテムを描画する
	 */
	private renderTopicItem(
		container: HTMLElement,
		topic: Topic,
		index: number,
	): void {
		const fileExists = this.plugin.app.vault.getAbstractFileByPath(
			topic.filePath,
		);

		const itemEl = container.createDiv({
			cls: "topic-item",
			attr: { "data-topic-id": topic.id, draggable: "true" },
		});

		// 番号
		itemEl.createDiv({
			cls: "topic-number",
			text: `${index + 1}.`,
		});

		// コンテンツ部分
		const contentWrapper = itemEl.createDiv({
			cls: "topic-content-wrapper",
		});

		// 内容（Markdownとしてレンダリング）
		const contentEl = contentWrapper.createDiv({
			cls: "topic-content",
		});
		void MarkdownRenderer.render(
			this.plugin.app,
			topic.originalContent,
			contentEl,
			topic.filePath,
			this.renderComponent,
		);

		// Frontmatter情報
		this.renderFrontmatter(contentWrapper, topic.filePath);

		// ファイル情報（設定に応じて表示）
		if (this.plugin.settings.showFileName) {
			const fileName = topic.filePath.split("/").pop() ?? topic.filePath;
			contentWrapper.createDiv({
				cls: "topic-file-info",
				text: fileName,
			});
		}

		// アラート（ファイル不在時）
		if (!fileExists) {
			contentWrapper.createDiv({
				cls: "topic-alert",
				text: "⚠ File not found",
			});
		}

		// アクション
		const actionsEl = itemEl.createDiv({ cls: "topic-actions" });
		const deleteBtn = actionsEl.createEl("button", {
			cls: "topic-delete-btn",
			attr: { "aria-label": "Delete topic" },
		});
		deleteBtn.textContent = "×";

		// イベントハンドラ
		itemEl.addEventListener("click", (e) => {
			if (
				e.target === deleteBtn ||
				(e.target as HTMLElement).closest(".topic-delete-btn")
			) {
				return;
			}
			void this.handleTopicClick(topic);
		});

		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.handleDelete(topic);
		});

		// ドラッグ＆ドロップ
		this.setupDragAndDrop(itemEl, index);
	}

	/**
	 * Frontmatter情報を描画する
	 */
	private renderFrontmatter(container: HTMLElement, filePath: string): void {
		const keys = this.plugin.settings.frontmatterKeys;
		if (keys.length === 0) {
			return;
		}

		const values = getFrontmatterValues(this.plugin.app, filePath, keys);
		if (values.size === 0) {
			return;
		}

		const frontmatterEl = container.createDiv({
			cls: "topic-frontmatter",
		});

		for (const key of keys) {
			const value = values.get(key);
			if (value) {
				const itemEl = frontmatterEl.createSpan({
					cls: "topic-frontmatter-item",
				});
				itemEl.createSpan({
					cls: "topic-frontmatter-key",
					text: `${key}: `,
				});
				itemEl.createSpan({
					cls: "topic-frontmatter-value",
					text: value,
				});
			}
		}
	}

	/**
	 * トピッククリック時の処理
	 */
	private async handleTopicClick(topic: {
		filePath: string;
		startLine: number;
	}): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(
			topic.filePath,
		);
		if (!file) {
			// ファイルが存在しない
			return;
		}

		await this.plugin.app.workspace.openLinkText(topic.filePath, "", false);

		const view =
			this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) {
			const editor = view.editor;
			editor.setCursor({ line: topic.startLine, ch: 0 });
			editor.scrollIntoView(
				{
					from: { line: topic.startLine, ch: 0 },
					to: { line: topic.startLine, ch: 0 },
				},
				true,
			);
		}
	}

	/**
	 * 削除ボタンクリック時の処理
	 */
	private async handleDelete(topic: Topic): Promise<void> {
		// ファイルからブロックIDを削除
		const file = this.plugin.app.vault.getAbstractFileByPath(
			topic.filePath,
		);
		if (file instanceof TFile) {
			await removeBlockIdFromFile(this.plugin, file, topic.blockId);
		}

		// トピックを削除
		await this.plugin.topicStore.removeTopic(topic.id);
	}

	/**
	 * ドラッグ＆ドロップを設定する
	 */
	private setupDragAndDrop(itemEl: HTMLElement, index: number): void {
		itemEl.addEventListener("dragstart", (e) => {
			e.dataTransfer?.setData("text/plain", index.toString());
			itemEl.addClass("dragging");
		});

		itemEl.addEventListener("dragend", () => {
			itemEl.removeClass("dragging");
		});

		itemEl.addEventListener("dragover", (e) => {
			e.preventDefault();
			itemEl.addClass("drag-over");
		});

		itemEl.addEventListener("dragleave", () => {
			itemEl.removeClass("drag-over");
		});

		itemEl.addEventListener("drop", (e) => {
			e.preventDefault();
			itemEl.removeClass("drag-over");

			const fromIndex = parseInt(
				e.dataTransfer?.getData("text/plain") ?? "-1",
			);
			if (fromIndex >= 0 && fromIndex !== index) {
				void this.plugin.topicStore.reorderTopics(fromIndex, index);
			}
		});
	}
}
