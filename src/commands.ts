import { Editor, MarkdownView, Notice, TFile } from "obsidian";
import type TopicLinePlugin from "./main";
import { TOPIC_SIDEBAR_VIEW_TYPE } from "./topic-view";
import { ConfirmClearAllModal, ConfirmOverwriteModal } from "./confirm-modal";
import { Topic } from "./types";
import {
	addBlockIdToLine,
	findLineByBlockId,
	removeBlockIdFromLine,
} from "./utils";

/**
 * ファイルの指定行にブロックIDを挿入する。
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
 * ファイルから指定ブロックIDを削除する。
 * 対象ファイルが既に存在しない/見つからない場合は警告のみで成功扱い。
 */
export async function removeBlockIdFromFile(
	plugin: TopicLinePlugin,
	file: TFile,
	blockId: string,
): Promise<void> {
	try {
		const content = await plugin.app.vault.read(file);
		const lines = content.split("\n");

		const lineIndex = findLineByBlockId(lines, blockId);
		const targetLine = lines[lineIndex];
		if (lineIndex >= 0 && targetLine !== undefined) {
			lines[lineIndex] = removeBlockIdFromLine(targetLine);
			await plugin.app.vault.modify(file, lines.join("\n"));
		}
	} catch (e) {
		console.warn(
			`[topic-lines] Skipping block ID cleanup for ${blockId}:`,
			e,
		);
	}
}

/**
 * 指定 topic のブロック ID をファイルから削除する（best-effort）。
 * ファイルが存在しない場合は何もしない。
 */
export async function cleanupTopicBlockId(
	plugin: TopicLinePlugin,
	topic: Topic,
): Promise<void> {
	const file = plugin.app.vault.getAbstractFileByPath(topic.filePath);
	if (file instanceof TFile) {
		await removeBlockIdFromFile(plugin, file, topic.blockId);
	}
}

/**
 * editor の選択範囲(または現在行)を取得する。
 */
function getEditorRange(editor: Editor): {
	from: { line: number; ch: number };
	to: { line: number; ch: number };
	content: string;
	isEmpty: boolean;
} {
	const selection = editor.getSelection();
	if (selection) {
		return {
			from: editor.getCursor("from"),
			to: editor.getCursor("to"),
			content: selection,
			isEmpty: false,
		};
	}
	const cursor = editor.getCursor();
	const line = editor.getLine(cursor.line);
	return {
		from: { line: cursor.line, ch: 0 },
		to: { line: cursor.line, ch: 0 },
		content: line,
		isEmpty: !line.trim(),
	};
}

/**
 * 指定 slot に topic をセットしてブロック ID を挿入する共通処理。
 * 既に占有されている場合は古い topic の block ID を cleanup する。
 */
async function setTopicAndInsertBlockId(
	plugin: TopicLinePlugin,
	slotIndex: number,
	file: TFile,
	from: { line: number; ch: number },
	to: { line: number; ch: number },
	content: string,
): Promise<Topic | null> {
	const result = await plugin.topicStore.setTopicToSlot(slotIndex, {
		filePath: file.path,
		startLine: from.line,
		endLine: to.line,
		originalContent: content,
	});
	if (!result) return null;

	if (result.replaced) {
		await cleanupTopicBlockId(plugin, result.replaced);
	}

	await insertBlockIdToFile(plugin, file, from.line, result.topic.blockId);
	return result.topic;
}

/**
 * プラグインの静的コマンドを登録する。
 * per-slot の動的コマンドは registerPerSlotCommands で登録する。
 */
export function registerCommands(plugin: TopicLinePlugin): void {
	// Register selected lines: 並び順で最初の空 slot に topic をセット
	plugin.addCommand({
		id: "register-topic",
		name: "Register selected lines",
		editorCallback: async (editor: Editor, view: MarkdownView) => {
			const file = view.file;
			if (!file) {
				new Notice("No file is open");
				return;
			}

			const { from, to, content, isEmpty } = getEditorRange(editor);
			if (isEmpty) {
				new Notice("Current line is empty");
				return;
			}

			const overlapping = findOverlappingTopic(plugin, file.path, from, to);
			if (overlapping) {
				new Notice("Topic already registered on this line");
				return;
			}

			const slotIndex = plugin.topicStore.findFirstEmptySlotIndex();
			if (slotIndex === -1) {
				new Notice("No empty slot available.");
				return;
			}

			await setTopicAndInsertBlockId(
				plugin,
				slotIndex,
				file,
				from,
				to,
				content,
			);
			new Notice("Topic registered");
		},
	});

	// Unregister selected lines: 該当 topic を含む slot を空にする
	plugin.addCommand({
		id: "unregister-topic",
		name: "Unregister selected lines",
		editorCallback: async (editor: Editor, view: MarkdownView) => {
			const file = view.file;
			if (!file) {
				new Notice("No file is open");
				return;
			}

			const { from, to } = getEditorRange(editor);
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

			for (const topic of overlappingTopics) {
				await removeBlockIdFromFile(plugin, file, topic.blockId);
				const slotIndex = plugin.topicStore.findTopicSlotIndex(topic.id);
				if (slotIndex >= 0) {
					await plugin.topicStore.clearSlot(slotIndex);
				}
			}

			const count = overlappingTopics.length;
			new Notice(
				count === 1
					? "Topic unregistered"
					: `${count} topics unregistered`,
			);
		},
	});

	// Toggle current line: 既存ありなら解除、なければ最初の空 slot に登録
	plugin.addCommand({
		id: "toggle-register-topic",
		name: "Toggle current line",
		editorCallback: async (editor: Editor, view: MarkdownView) => {
			const file = view.file;
			if (!file) {
				new Notice("No file is open");
				return;
			}

			const { from, to, content, isEmpty } = getEditorRange(editor);
			if (isEmpty) {
				new Notice("Current line is empty");
				return;
			}

			const overlapping = findOverlappingTopic(plugin, file.path, from, to);

			if (overlapping) {
				await removeBlockIdFromFile(plugin, file, overlapping.blockId);
				const slotIndex = plugin.topicStore.findTopicSlotIndex(
					overlapping.id,
				);
				if (slotIndex >= 0) {
					await plugin.topicStore.clearSlot(slotIndex);
				}
				new Notice("Topic unregistered");
				return;
			}

			const slotIndex = plugin.topicStore.findFirstEmptySlotIndex();
			if (slotIndex === -1) {
				new Notice("No empty slot available.");
				return;
			}

			await setTopicAndInsertBlockId(
				plugin,
				slotIndex,
				file,
				from,
				to,
				content,
			);
			new Notice("Topic registered");
		},
	});

	// Jump to topic 1〜9: 並び順で N 番目の slot にある topic にジャンプ。
	// v1 から引き継ぐ固定コマンド。slot 数 < N の場合は invocation 時に bounds-check で Notice。
	for (let n = 1; n <= 9; n++) {
		const positionIndex = n - 1;
		plugin.addCommand({
			id: `jump-to-topic-${n}`,
			name: `Jump to topic ${n}`,
			callback: () => {
				void jumpToSlotByIndex(plugin, positionIndex);
			},
		});
	}

	// Show sidebar: サイドバーを表示/作成
	plugin.addCommand({
		id: "show-topic-view",
		name: "Show sidebar",
		callback: () => {
			const leaves = plugin.app.workspace.getLeavesOfType(
				TOPIC_SIDEBAR_VIEW_TYPE,
			);
			if (leaves.length > 0 && leaves[0]) {
				void plugin.app.workspace.revealLeaf(leaves[0]);
			} else {
				const rightLeaf = plugin.app.workspace.getRightLeaf(false);
				if (rightLeaf) {
					void rightLeaf.setViewState({
						type: TOPIC_SIDEBAR_VIEW_TYPE,
						active: true,
					});
				}
			}
		},
	});

	// Clear all topics: 全 slot を空にする（slot 自体は残す）
	plugin.addCommand({
		id: "clear-all-topics",
		name: "Clear all topics",
		callback: () => {
			const slots = plugin.topicStore.getSlots();
			const occupiedCount = slots.filter((s) => s.topic !== null).length;
			if (occupiedCount === 0) {
				new Notice("No topics to clear");
				return;
			}
			new ConfirmClearAllModal(plugin.app, occupiedCount, () => {
				void clearAllTopicsConfirmed(plugin);
			}).open();
		},
	});
}

/**
 * 確認後の全 topic クリア処理（sidebar からも呼ばれる）。
 */
export async function clearAllTopicsConfirmed(
	plugin: TopicLinePlugin,
): Promise<void> {
	const removed = await plugin.topicStore.clearAllSlots();
	for (const topic of removed) {
		await cleanupTopicBlockId(plugin, topic);
	}
	new Notice("All topics cleared");
}

/**
 * 選択範囲と重複する topic を探す（重複検出用）。
 */
function findOverlappingTopic(
	plugin: TopicLinePlugin,
	filePath: string,
	from: { line: number },
	to: { line: number },
): Topic | undefined {
	const existing = plugin.topicStore.getTopicsByFilePath(filePath);
	return existing.find(
		(topic) => from.line <= topic.endLine && to.line >= topic.startLine,
	);
}

/**
 * per-slot 動的コマンドを登録する。
 *
 * HARD REQUIREMENT: callback は invocation 時に slot を解決する。
 * registration 時の `slot` 変数を closure キャプチャしてはならない。
 * 安定なのは index のみ。
 */
export function registerPerSlotCommands(plugin: TopicLinePlugin): void {
	const slots = plugin.topicStore.getSlots();
	for (let i = 0; i < slots.length; i++) {
		registerSetTopicToSlotCommand(plugin, i, slots[i]?.name ?? `slot${i + 1}`);
		registerJumpToSlotCommand(plugin, i, slots[i]?.name ?? `slot${i + 1}`);
	}
}

/**
 * per-slot コマンドの ID 規約。
 * Obsidian の addCommand は内部で `${plugin.manifest.id}:${id}` を生成するため
 * removeCommand には完全修飾 ID を渡す必要がある。
 */
export function setTopicCommandId(plugin: TopicLinePlugin, slotIndex: number): string {
	return `${plugin.manifest.id}:set-topic-to-slot-${slotIndex}`;
}

export function jumpToSlotCommandId(
	plugin: TopicLinePlugin,
	slotIndex: number,
): string {
	return `${plugin.manifest.id}:jump-to-slot-${slotIndex}`;
}

/**
 * 既存の per-slot コマンドを全て削除し、現在の slot 状態に基づいて再登録する。
 * 名前変更・並び替え・追加・削除のいずれの場合も最新状態に同期される。
 *
 * @param prevCount 直前に登録されていた per-slot コマンドの数
 *                  （これだけ removeCommand を呼ぶ必要がある）
 */
export function refreshPerSlotCommands(
	plugin: TopicLinePlugin,
	prevCount: number,
): void {
	for (let i = 0; i < prevCount; i++) {
		plugin.removeCommand(setTopicCommandId(plugin, i));
		plugin.removeCommand(jumpToSlotCommandId(plugin, i));
	}
	registerPerSlotCommands(plugin);
}

/**
 * 単一 slot 用 set コマンドを登録する。
 * slot 追加時にも呼ばれる。
 */
export function registerSetTopicToSlotCommand(
	plugin: TopicLinePlugin,
	slotIndex: number,
	slotName: string,
): void {
	plugin.addCommand({
		id: `set-topic-to-slot-${slotIndex}`,
		name: `Set topic to ${slotName}`,
		editorCallback: async (editor: Editor, view: MarkdownView) => {
			const file = view.file;
			if (!file) {
				new Notice("No file is open");
				return;
			}
			const currentSlot = plugin.topicStore.getSlotByIndex(slotIndex);
			if (!currentSlot) {
				new Notice(
					`Slot ${slotIndex + 1} no longer exists. Restart plugin to clean up old commands.`,
				);
				return;
			}

			const { from, to, content, isEmpty } = getEditorRange(editor);
			if (isEmpty) {
				new Notice("Current line is empty");
				return;
			}

			const overlapping = findOverlappingTopic(plugin, file.path, from, to);
			if (overlapping) {
				new Notice("Topic already registered on this line");
				return;
			}

			const apply = async () => {
				await setTopicAndInsertBlockId(
					plugin,
					slotIndex,
					file,
					from,
					to,
					content,
				);
				new Notice(`Topic set to "${currentSlot.name}"`);
			};

			if (currentSlot.topic === null) {
				await apply();
				return;
			}

			const mode = plugin.topicStore.getSettings().collisionMode;
			if (mode === "overwrite") {
				await apply();
				return;
			}
			new ConfirmOverwriteModal(plugin.app, currentSlot.name, () => {
				void apply();
			}).open();
		},
	});
}

/**
 * 単一 slot 用 jump コマンドを登録する。
 * slot 追加時にも呼ばれる。
 */
export function registerJumpToSlotCommand(
	plugin: TopicLinePlugin,
	slotIndex: number,
	slotName: string,
): void {
	plugin.addCommand({
		id: `jump-to-slot-${slotIndex}`,
		name: `Jump to ${slotName}`,
		callback: () => {
			void jumpToSlotByIndex(plugin, slotIndex);
		},
	});
}

/**
 * 指定インデックスの slot にある topic にジャンプする共通処理。
 * `Jump to topic N` (位置ベース固定) と `Jump to {slotName}` (per-slot 動的) の両方から呼ばれる。
 */
async function jumpToSlotByIndex(
	plugin: TopicLinePlugin,
	slotIndex: number,
): Promise<void> {
	const currentSlot = plugin.topicStore.getSlotByIndex(slotIndex);
	if (!currentSlot) {
		new Notice(`Slot ${slotIndex + 1} not found`);
		return;
	}
	const topic = currentSlot.topic;
	if (!topic) {
		new Notice(`Slot "${currentSlot.name}" is empty`);
		return;
	}

	const file = plugin.app.vault.getAbstractFileByPath(topic.filePath);
	if (!file) {
		new Notice(`File not found: ${topic.filePath}`);
		return;
	}

	await plugin.app.workspace.openLinkText(topic.filePath, "", false);

	const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
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
