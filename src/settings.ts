/**
 * プラグイン設定のインターフェース
 */
export interface TopicLineSettings {
	/** 表示するfrontmatterキーのリスト */
	frontmatterKeys: string[];

	/** ファイル名を表示するか */
	showFileName: boolean;
}

/**
 * デフォルト設定
 */
export const DEFAULT_SETTINGS: TopicLineSettings = {
	frontmatterKeys: [],
	showFileName: false,
};
