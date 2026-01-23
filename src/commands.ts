import { Editor, MarkdownView, Notice, TFile } from "obsidian";
import type TopicLinePlugin from "./main";
import { VIEW_TYPE_TOPIC_LINES } from "./topic-view";
import {
	addBlockIdToLine,
	removeBlockIdFromLine,
	findLineByBlockId,
} from "./utils";

/**
 * ファイルの指定行にブロックIDを挿入する
 */
async function insertBlockIdToFile(
	plugin: TopicLinePlugin,
	file: TFile,
	lineIndex: number,
	blockId: string,
): Promise<void> {
	const content = await plugin.app.vault.read(file);
	const lines = content.split("\n");

	const targetLine = lines[lineIndex];
	if (
		lineIndex >= 0 &&
		lineIndex < lines.length &&
		targetLine !== undefined
	) {
		lines[lineIndex] = addBlockIdToLine(targetLine, blockId);
		await plugin.app.vault.modify(file, lines.join("\n"));
	}
}

/**
 * ファイルから指定ブロックIDを削除する
 */
export async function removeBlockIdFromFile(
	plugin: TopicLinePlugin,
	file: TFile,
	blockId: string,
): Promise<void> {
	const content = await plugin.app.vault.read(file);
	const lines = content.split("\n");

	const lineIndex = findLineByBlockId(lines, blockId);
	const targetLine = lines[lineIndex];
	if (lineIndex >= 0 && targetLine !== undefined) {
		lines[lineIndex] = removeBlockIdFromLine(targetLine);
		await plugin.app.vault.modify(file, lines.join("\n"));
	}
}

/**
 * プラグインのコマンドを登録する
 */
export function registerCommands(plugin: TopicLinePlugin): void {
	// トピック登録コマンド
	plugin.addCommand({
		id: "register-topic",
		name: "Register selected lines",
		editorCallback: async (editor: Editor, view: MarkdownView) => {
			const file = view.file;
			if (!file) {
				new Notice("No file is open");
				return;
			}

			const selection = editor.getSelection();
			let from: { line: number; ch: number };
			let to: { line: number; ch: number };
			let content: string;

			if (selection) {
				// 範囲選択がある場合は選択範囲を使用
				from = editor.getCursor("from");
				to = editor.getCursor("to");
				content = selection;
			} else {
				// 範囲選択がない場合は現在のカーソル行を使用
				const cursor = editor.getCursor();
				from = { line: cursor.line, ch: 0 };
				to = { line: cursor.line, ch: 0 };
				content = editor.getLine(cursor.line);

				if (!content.trim()) {
					new Notice("Current line is empty");
					return;
				}
			}

			const topic = await plugin.topicStore.addTopic({
				filePath: file.path,
				startLine: from.line,
				endLine: to.line,
				originalContent: content,
			});

			if (topic) {
				// ファイルの開始行にブロックIDを挿入
				await insertBlockIdToFile(
					plugin,
					file,
					from.line,
					topic.blockId,
				);
				new Notice("Topic registered");
			} else {
				new Notice("Cannot add topic: maximum limit (20) reached");
			}
		},
	});

	// トピック解除コマンド
	plugin.addCommand({
		id: "unregister-topic",
		name: "Unregister selected lines",
		editorCallback: async (editor: Editor, view: MarkdownView) => {
			const file = view.file;
			if (!file) {
				new Notice("No file is open");
				return;
			}

			const selection = editor.getSelection();
			let from: { line: number; ch: number };
			let to: { line: number; ch: number };

			if (selection) {
				from = editor.getCursor("from");
				to = editor.getCursor("to");
			} else {
				const cursor = editor.getCursor();
				from = { line: cursor.line, ch: 0 };
				to = { line: cursor.line, ch: 0 };
			}

			// 現在の選択範囲と重複するトピックを探す
			const existingTopics = plugin.topicStore.getTopicsByFilePath(
				file.path,
			);
			const overlappingTopics = existingTopics.filter(
				(topic) =>
					from.line <= topic.endLine && to.line >= topic.startLine,
			);

			if (overlappingTopics.length === 0) {
				new Notice("No topic found on selected lines");
				return;
			}

			// 重複するすべてのトピックを解除
			for (const topic of overlappingTopics) {
				await removeBlockIdFromFile(plugin, file, topic.blockId);
				await plugin.topicStore.removeTopic(topic.id);
			}

			const count = overlappingTopics.length;
			new Notice(
				count === 1
					? "Topic unregistered"
					: `${count} topics unregistered`,
			);
		},
	});

	// トピック登録/解除トグルコマンド
	plugin.addCommand({
		id: "toggle-register-topic",
		name: "Toggle current line",
		editorCallback: async (editor: Editor, view: MarkdownView) => {
			const file = view.file;
			if (!file) {
				new Notice("No file is open");
				return;
			}

			const selection = editor.getSelection();
			let from: { line: number; ch: number };
			let to: { line: number; ch: number };
			let content: string;

			if (selection) {
				from = editor.getCursor("from");
				to = editor.getCursor("to");
				content = selection;
			} else {
				const cursor = editor.getCursor();
				from = { line: cursor.line, ch: 0 };
				to = { line: cursor.line, ch: 0 };
				content = editor.getLine(cursor.line);

				if (!content.trim()) {
					new Notice("Current line is empty");
					return;
				}
			}

			// 現在の選択範囲と重複するトピックを探す
			const existingTopics = plugin.topicStore.getTopicsByFilePath(
				file.path,
			);
			const overlappingTopic = existingTopics.find(
				(topic) =>
					from.line <= topic.endLine && to.line >= topic.startLine,
			);

			if (overlappingTopic) {
				// 重複するトピックがある場合は解除
				await removeBlockIdFromFile(
					plugin,
					file,
					overlappingTopic.blockId,
				);
				await plugin.topicStore.removeTopic(overlappingTopic.id);
				new Notice("Topic unregistered");
			} else {
				// 重複するトピックがない場合は登録
				const topic = await plugin.topicStore.addTopic({
					filePath: file.path,
					startLine: from.line,
					endLine: to.line,
					originalContent: content,
				});

				if (topic) {
					await insertBlockIdToFile(
						plugin,
						file,
						from.line,
						topic.blockId,
					);
					new Notice("Topic registered");
				} else {
					new Notice("Cannot add topic: maximum limit (20) reached");
				}
			}
		},
	});

	// ジャンプコマンド（1〜3）
	for (let i = 1; i <= 9; i++) {
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
		name: "Show sidebar",
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

	// 全トピック削除コマンド
	plugin.addCommand({
		id: "clear-all-topics",
		name: "Clear all topics",
		callback: async () => {
			const topics = plugin.topicStore.getTopics();
			if (topics.length === 0) {
				new Notice("No topics to clear");
				return;
			}

			// 各トピックのブロックIDをファイルから削除
			for (const topic of topics) {
				const file = plugin.app.vault.getAbstractFileByPath(
					topic.filePath,
				);
				if (file instanceof TFile) {
					await removeBlockIdFromFile(plugin, file, topic.blockId);
				}
			}

			// すべてのトピックを削除
			await plugin.topicStore.clearAllTopics();
			new Notice("All topics cleared");
		},
	});
}
