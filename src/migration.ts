import { DEFAULT_SETTINGS, TopicLineSettings } from "./settings";
import {
	DEFAULT_SLOT_COUNT,
	DEFAULT_SLOT_NAMES,
	SLOT_LIMIT,
	Slot,
	Topic,
	TopicDataV1,
	TopicDataV2,
} from "./types";

/**
 * v1 形式のデータか判定する。
 * version === 1、または version プロパティ無しで topics 配列のみ持つ旧形式も受け付ける。
 */
export function isV1Data(raw: unknown): raw is TopicDataV1 {
	if (raw === null || typeof raw !== "object") return false;
	const obj = raw as Record<string, unknown>;
	if (obj.version === 1) return true;
	if (obj.version === undefined && Array.isArray(obj.topics)) return true;
	return false;
}

/**
 * v2 形式のデータか判定する。
 */
export function isV2Data(raw: unknown): raw is TopicDataV2 {
	if (raw === null || typeof raw !== "object") return false;
	const obj = raw as Record<string, unknown>;
	return obj.version === 2 && Array.isArray(obj.slots);
}

/**
 * デフォルトの v2 データ（fresh start 用）。
 */
function defaultV2Data(): TopicDataV2 {
	const slots: Slot[] = [];
	for (let i = 0; i < DEFAULT_SLOT_COUNT; i++) {
		slots.push({ name: DEFAULT_SLOT_NAMES[i] ?? `slot${i + 1}`, topic: null });
	}
	return {
		version: 2,
		slots,
		settings: { ...DEFAULT_SETTINGS },
	};
}

/**
 * v1 データから設定を抽出する（v1 では plugin の loadData の中に
 * settings キーが同居していたため、それを復元する）。
 */
function extractV1Settings(raw: unknown): Partial<TopicLineSettings> {
	if (raw === null || typeof raw !== "object") return {};
	const obj = raw as Record<string, unknown>;
	const settings = obj.settings;
	if (settings === null || typeof settings !== "object") return {};
	return settings as Partial<TopicLineSettings>;
}

/**
 * v1 形式のデータを v2 形式に変換する。
 *
 * - 入力が認識できない場合はデフォルトの v2 データを返す（droppedCount: 0）
 * - 上限 (SLOT_LIMIT = 20) を超えた topic は破棄され droppedCount で報告される
 * - 既存の settings (`frontmatterKeys`, `showFileName`) は保持される
 * - `collisionMode` は v1 に存在しないため "confirm" がデフォルト適用される
 */
export function migrateV1ToV2(raw: unknown): {
	data: TopicDataV2;
	droppedCount: number;
} {
	console.debug(
		"[topic-lines] Pre-migration v1 data:",
		JSON.stringify(raw, null, 2),
	);

	if (!isV1Data(raw)) {
		return { data: defaultV2Data(), droppedCount: 0 };
	}

	const v1 = raw as TopicDataV1 & {
		settings?: Partial<TopicLineSettings>;
	};
	const topics: Topic[] = Array.isArray(v1.topics) ? v1.topics : [];

	const kept = topics.slice(0, SLOT_LIMIT);
	const droppedCount = Math.max(0, topics.length - SLOT_LIMIT);

	const slots: Slot[] = kept.map((topic, i) => ({
		name: `slot${i + 1}`,
		topic,
	}));

	const v1Settings = extractV1Settings(raw);
	const settings: TopicLineSettings = {
		...DEFAULT_SETTINGS,
		...v1Settings,
		collisionMode: v1Settings.collisionMode ?? DEFAULT_SETTINGS.collisionMode,
	};

	console.debug(
		`[topic-lines] Migration: ${topics.length} v1 topics -> ${slots.length} v2 slots`,
	);

	return {
		data: { version: 2, slots, settings },
		droppedCount,
	};
}
