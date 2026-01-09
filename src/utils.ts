import { App, TFile } from "obsidian";

/**
 * UUID v4を生成する
 */
export function generateUUID(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * トピック用のブロックIDを生成する（Obsidian標準形式）
 * 形式: topic-{6文字のランダム英数字}
 */
export function generateBlockId(): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let result = "topic-";
	for (let i = 0; i < 6; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

/**
 * ブロックIDのパターン（行末の ^block-id を検出）
 */
export const BLOCK_ID_PATTERN = / \^([\w-]+)$/;

/**
 * 行からブロックIDを抽出する
 * @returns ブロックID（^なし）、見つからない場合はnull
 */
export function extractBlockId(line: string): string | null {
	const match = line.match(BLOCK_ID_PATTERN);
	return match?.[1] ?? null;
}

/**
 * 行にブロックIDを追加する
 */
export function addBlockIdToLine(line: string, blockId: string): string {
	const existingId = extractBlockId(line);
	if (existingId) {
		return line.replace(BLOCK_ID_PATTERN, ` ^${blockId}`);
	}
	return `${line} ^${blockId}`;
}

/**
 * 行からブロックIDを削除する
 */
export function removeBlockIdFromLine(line: string): string {
	return line.replace(BLOCK_ID_PATTERN, "");
}

/**
 * ファイル内容から指定ブロックIDを持つ行のインデックスを検索する
 * @returns 行インデックス（0-indexed）、見つからない場合は-1
 */
export function findLineByBlockId(lines: string[], blockId: string): number {
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const lineBlockId = extractBlockId(line);
		if (lineBlockId === blockId) {
			return i;
		}
	}
	return -1;
}

/**
 * 指定パスのファイルが存在するか確認する
 */
export function fileExists(app: App, path: string): boolean {
	const file = app.vault.getAbstractFileByPath(path);
	return file instanceof TFile;
}

/**
 * 指定パスのファイルを取得する（存在しない場合はnull）
 */
export function getFile(app: App, path: string): TFile | null {
	const file = app.vault.getAbstractFileByPath(path);
	return file instanceof TFile ? file : null;
}

/**
 * 関数の実行をデバウンスする
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
	func: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout> | null = null;

	return (...args: Parameters<T>) => {
		if (timeout !== null) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(() => {
			func(...args);
			timeout = null;
		}, wait);
	};
}
