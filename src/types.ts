/**
 * トピックを表す型
 */
export interface Topic {
	/** 一意識別子（UUID v4） */
	id: string;

	/** 元ノートのVault内相対パス */
	filePath: string;

	/** 登録時の開始行番号（0-indexed） */
	startLine: number;

	/** 登録時の終了行番号（0-indexed、inclusive） */
	endLine: number;

	/** 登録時点のテキスト内容（キャッシュ用） */
	originalContent: string;

	/** 登録日時（ISO 8601形式） */
	createdAt: string;
}

/**
 * 永続化用のトピックデータ型
 */
export interface TopicData {
	/** データフォーマットバージョン（将来の移行用） */
	version: 1;

	/** トピック配列（表示順） */
	topics: Topic[];
}
