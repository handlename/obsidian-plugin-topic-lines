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
