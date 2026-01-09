import { Editor, MarkdownView, Notice } from "obsidian";
import type TopicLinePlugin from "./main";
import { VIEW_TYPE_TOPIC_LINES } from "./topic-view";

/**
 * プラグインのコマンドを登録する
 */
export function registerCommands(plugin: TopicLinePlugin): void {
	// トピック登録コマンド
	plugin.addCommand({
		id: "register-topic",
		name: "Register topic",
		editorCallback: async (editor: Editor, view: MarkdownView) => {
			const file = view.file;
			if (!file) {
				new Notice("No file is open");
				return;
			}

			const selection = editor.getSelection();
			if (!selection) {
				new Notice("No text selected");
				return;
			}

			const from = editor.getCursor("from");
			const to = editor.getCursor("to");

			const topic = await plugin.topicStore.addTopic({
				filePath: file.path,
				startLine: from.line,
				endLine: to.line,
				originalContent: selection,
			});

			if (topic) {
				new Notice("Topic registered");
			} else {
				new Notice("Cannot add topic: maximum limit (20) reached");
			}
		},
	});

	// ジャンプコマンド（1〜3）
	for (let i = 1; i <= 3; i++) {
		plugin.addCommand({
			id: `jump-to-topic-${i}`,
			name: `Jump to topic ${i}`,
			callback: async () => {
				const topic = plugin.topicStore.getTopicByIndex(i - 1);
				if (!topic) {
					new Notice(`Topic ${i} not found`);
					return;
				}

				const file = plugin.app.vault.getAbstractFileByPath(
					topic.filePath,
				);
				if (!file) {
					new Notice(`File not found: ${topic.filePath}`);
					return;
				}

				await plugin.app.workspace.openLinkText(
					topic.filePath,
					"",
					false,
				);

				const view =
					plugin.app.workspace.getActiveViewOfType(MarkdownView);
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
			},
		});
	}

	// サイドバー表示コマンド
	plugin.addCommand({
		id: "show-topic-view",
		name: "Show topic lines",
		callback: () => {
			const leaves = plugin.app.workspace.getLeavesOfType(
				VIEW_TYPE_TOPIC_LINES,
			);
			if (leaves.length > 0 && leaves[0]) {
				void plugin.app.workspace.revealLeaf(leaves[0]);
			} else {
				const rightLeaf = plugin.app.workspace.getRightLeaf(false);
				if (rightLeaf) {
					void rightLeaf.setViewState({
						type: VIEW_TYPE_TOPIC_LINES,
						active: true,
					});
				}
			}
		},
	});
}
