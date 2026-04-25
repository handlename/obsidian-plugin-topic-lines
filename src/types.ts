import type { TopicLineSettings } from "./settings";

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

	/** ブロックID（Obsidian標準形式 ^block-id、開始行に付与） */
	blockId: string;

	/** トピックの行数（endLine - startLine + 1） */
	lineCount: number;
}

/**
 * 衝突時の挙動モード（per-slot direct-set commands で参照）
 */
export type CollisionMode = "overwrite" | "confirm";

/**
 * Slot は名前付きの topic 配置先（v2 のコア概念）
 */
export interface Slot {
	/** スロット名（ユーザーが設定可能） */
	name: string;

	/** スロットに紐づくトピック（空の場合は null） */
	topic: Topic | null;
}

/**
 * v1 永続化フォーマット（マイグレーション専用）
 */
export interface TopicDataV1 {
	/** データフォーマットバージョン */
	version: 1;

	/** トピック配列（表示順） */
	topics: Topic[];
}

/**
 * v2 永続化フォーマット（slot ベース）
 */
export interface TopicDataV2 {
	/** データフォーマットバージョン */
	version: 2;

	/** スロット配列（表示順） */
	slots: Slot[];

	/** プラグイン設定（v2 では TopicData の中に保持） */
	settings: TopicLineSettings;
}

/**
 * loadData() 結果のパース用ユニオン型
 */
export type TopicDataAny = TopicDataV1 | TopicDataV2;

/** スロット数の上限 */
export const SLOT_LIMIT = 20;

/** スロット数の下限 */
export const SLOT_MIN = 1;

/** デフォルトのスロット数 */
export const DEFAULT_SLOT_COUNT = 3;

/** デフォルトのスロット名 */
export const DEFAULT_SLOT_NAMES = ["slot1", "slot2", "slot3"] as const;

/** スロット名の最大文字数 */
export const SLOT_NAME_MAX_LENGTH = 50;
