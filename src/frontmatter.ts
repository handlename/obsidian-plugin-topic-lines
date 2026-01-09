import { App, TFile } from "obsidian";

/**
 * frontmatter値を表示用文字列にフォーマットする
 * 配列はカンマ区切りで連結
 */
export function formatFrontmatterValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (Array.isArray(value)) {
		return value.map((v) => String(v)).join(", ");
	}

	if (typeof value === "object") {
		return JSON.stringify(value);
	}

	if (typeof value === "string") {
		return value;
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	return "";
}

/**
 * ファイルのfrontmatterから指定キーの値を取得する
 * @param app Obsidian App インスタンス
 * @param filePath ファイルパス
 * @param keys 取得するキーのリスト
 * @returns キーと値のマップ（存在しないキーは含まない）
 */
export function getFrontmatterValues(
	app: App,
	filePath: string,
	keys: string[],
): Map<string, string> {
	const result = new Map<string, string>();

	if (keys.length === 0) {
		return result;
	}

	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) {
		return result;
	}

	const cache = app.metadataCache.getFileCache(file);
	const frontmatter = cache?.frontmatter;

	if (!frontmatter) {
		return result;
	}

	for (const key of keys) {
		if (key in frontmatter) {
			const value: unknown = frontmatter[key];
			const formatted = formatFrontmatterValue(value);
			if (formatted) {
				result.set(key, formatted);
			}
		}
	}

	return result;
}
