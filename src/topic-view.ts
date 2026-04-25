import {
	Component,
	ItemView,
	MarkdownRenderer,
	MarkdownView,
	Menu,
	WorkspaceLeaf,
	setIcon,
} from "obsidian";
import type TopicLinePlugin from "./main";
import { Slot, Topic } from "./types";
import {
	cleanupTopicBlockId,
	clearAllTopicsConfirmed,
} from "./commands";
import { ConfirmClearAllModal } from "./confirm-modal";
import { getFrontmatterValues } from "./frontmatter";
import { dedent } from "./utils";

export const TOPIC_SIDEBAR_VIEW_TYPE = "topic-lines-view";

/**
 * サイドバーに slot 一覧（topic 含む）を表示するビュー（v2）。
 */
export class TopicSidebarView extends ItemView {
	private plugin: TopicLinePlugin;
	private renderComponent: Component;
	private handleStoreChange: () => void;
	private handleSettingsChange: () => void;

	constructor(leaf: WorkspaceLeaf, plugin: TopicLinePlugin) {
		super(leaf);
		this.plugin = plugin;
		this.renderComponent = new Component();
		this.handleStoreChange = () => this.render();
		this.handleSettingsChange = () => this.render();
	}

	getViewType(): string {
		return TOPIC_SIDEBAR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Topic lines";
	}

	getIcon(): string {
		return "list";
	}

	async onOpen(): Promise<void> {
		this.render();
		this.plugin.topicStore.onChange(this.handleStoreChange);
		this.plugin.onSettingsChange(this.handleSettingsChange);
	}

	async onClose(): Promise<void> {
		this.plugin.topicStore.offChange(this.handleStoreChange);
		this.plugin.offSettingsChange(this.handleSettingsChange);
		this.renderComponent.unload();
	}

	/**
	 * ビューを再描画する。
	 * 全 slot を並び順で表示し、空 slot もプレースホルダとして表示する。
	 */
	render(): void {
		const container = this.containerEl.children[1] as
			| HTMLElement
			| undefined;
		if (!container) return;
		container.empty();

		const slots = this.plugin.topicStore.getSlots();

		// ヘッダー
		const headerContainer = container.createDiv({
			cls: "topic-lines-header",
		});
		const menuButton = headerContainer.createEl("button", {
			cls: "topic-lines-menu-button clickable-icon",
			attr: { "aria-label": "Menu" },
		});
		setIcon(menuButton, "menu");
		this.registerDomEvent(menuButton, "click", (event) => {
			this.showMenu(event);
		});

		const slotContainer = container.createDiv({
			cls: "topic-lines-container",
		});

		if (slots.length === 0) {
			slotContainer.createDiv({
				cls: "topic-lines-empty",
				text: "No slots configured",
			});
			return;
		}

		for (const [i, slot] of slots.entries()) {
			if (slot.topic) {
				this.renderSlotWithTopic(slotContainer, slot, slot.topic, i);
			} else {
				this.renderEmptySlot(slotContainer, slot);
			}
		}
	}

	/**
	 * topic がセットされた slot を描画する。
	 */
	private renderSlotWithTopic(
		container: HTMLElement,
		slot: Slot,
		topic: Topic,
		_slotIndex: number,
	): void {
		const fileExists = this.plugin.app.vault.getAbstractFileByPath(
			topic.filePath,
		);

		const itemEl = container.createDiv({
			cls: "topic-item",
			attr: { "data-topic-id": topic.id },
		});

		// 1行目: slot 名 + 削除ボタン
		const headerEl = itemEl.createDiv({ cls: "topic-item-header" });
		headerEl.createDiv({
			cls: "topic-slot-name",
			text: slot.name,
		});

		const deleteBtn = headerEl.createEl("button", {
			cls: "topic-delete-btn",
			attr: { "aria-label": "Clear slot" },
		});
		deleteBtn.textContent = "×";

		// 2行目: topic 内容（Markdown レンダリング）
		const contentEl = itemEl.createDiv({
			cls: "topic-content",
		});
		void MarkdownRenderer.render(
			this.plugin.app,
			dedent(topic.originalContent),
			contentEl,
			topic.filePath,
			this.renderComponent,
		);

		// 3行目: ファイル名（設定で有効な場合のみ）
		if (this.plugin.settings.showFileName) {
			const fileName = topic.filePath.split("/").pop() ?? topic.filePath;
			itemEl.createDiv({
				cls: "topic-file-info",
				text: fileName,
			});
		}

		// 補助情報: frontmatter / file-not-found warning
		this.renderFrontmatter(itemEl, topic.filePath);

		if (!fileExists) {
			itemEl.createDiv({
				cls: "topic-alert",
				text: "⚠ File not found",
			});
		}

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
	}

	/**
	 * 空 slot をプレースホルダとして描画する。
	 */
	private renderEmptySlot(container: HTMLElement, slot: Slot): void {
		const itemEl = container.createDiv({
			cls: "topic-item topic-item-empty",
		});
		itemEl.createDiv({
			cls: "topic-slot-name",
			text: slot.name,
		});
		itemEl.createDiv({
			cls: "topic-empty-placeholder",
			text: "(empty)",
		});
	}

	private renderFrontmatter(container: HTMLElement, filePath: string): void {
		const keys = this.plugin.settings.frontmatterKeys;
		if (keys.length === 0) return;

		const values = getFrontmatterValues(this.plugin.app, filePath, keys);
		if (values.size === 0) return;

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

	private async handleTopicClick(topic: {
		filePath: string;
		startLine: number;
	}): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(
			topic.filePath,
		);
		if (!file) return;

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

	private async handleDelete(topic: Topic): Promise<void> {
		await cleanupTopicBlockId(this.plugin, topic);
		const slotIndex = this.plugin.topicStore.findTopicSlotIndex(topic.id);
		if (slotIndex >= 0) {
			await this.plugin.topicStore.clearSlot(slotIndex);
		}
	}

	private showMenu(event: MouseEvent): void {
		const menu = new Menu();
		const occupiedCount = this.plugin.topicStore
			.getSlots()
			.filter((s) => s.topic !== null).length;

		menu.addItem((item) => {
			item.setTitle("Clear all")
				.setIcon("trash-2")
				.setDisabled(occupiedCount === 0)
				.onClick(() => {
					this.handleClearAll(occupiedCount);
				});
		});

		menu.showAtMouseEvent(event);
	}

	private handleClearAll(occupiedCount: number): void {
		new ConfirmClearAllModal(this.plugin.app, occupiedCount, () => {
			void clearAllTopicsConfirmed(this.plugin);
		}).open();
	}
}
