import type { CollisionMode } from "./types";

/**
 * プラグイン設定のインターフェース
 */
export interface TopicLineSettings {
	/** 表示するfrontmatterキーのリスト */
	frontmatterKeys: string[];

	/** ファイル名を表示するか */
	showFileName: boolean;

	/** per-slot direct-set コマンドが占有 slot に topic を設定する際の挙動 */
	collisionMode: CollisionMode;
}

/**
 * デフォルト設定
 */
export const DEFAULT_SETTINGS: TopicLineSettings = {
	frontmatterKeys: [],
	showFileName: false,
	collisionMode: "confirm",
};
