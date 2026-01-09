# 技術設計書: Obsidian Plugin Topic Lines

## 1. 概要

本文書は、REQUIREMENTS.md で定義された要件を実現するための技術設計を記述する。
追加要件（FR-010〜FR-012）を中心に、設定画面の実装とfrontmatter/ファイル名表示機能の設計を行う。

---

## 2. 技術スタック

### 2.1 採用技術

| カテゴリ | 技術 | バージョン | 選定理由 |
|---|---|---|---|
| 言語 | TypeScript | 5.x | 型安全性、Obsidian公式サンプル準拠 |
| ビルドツール | esbuild | 0.x | 高速ビルド、Obsidian公式サンプル準拠 |
| パッケージマネージャー | npm | - | プロジェクト既存構成 |
| Linter | ESLint | - | コード品質維持、Obsidian専用プラグイン対応 |
| UI | Obsidian API (ItemView, PluginSettingTab) | - | プラットフォーム標準、テーマ互換性確保 |

### 2.2 不採用技術

| 技術 | 不採用理由 |
|---|---|
| React/Vue | Obsidian標準APIで十分、追加依存を避ける |
| Rollup | esbuildで十分、既存構成を維持 |
| Tailwind CSS | Obsidianテーマ変数を使用するため不要 |

---

## 3. モジュール構成

### 3.1 現行構成

```
src/
├── main.ts           # プラグインエントリポイント（ライフサイクル管理）
├── settings.ts       # 設定インターフェースとデフォルト値
├── types.ts          # 型定義（Topic, TopicData）
├── topic-store.ts    # トピックデータ管理（CRUD・永続化）
├── topic-view.ts     # サイドバービュー（ItemView）
├── commands.ts       # コマンド登録
└── utils.ts          # ユーティリティ関数
```

### 3.2 追加・変更ファイル

| ファイル | 変更内容 |
|---|---|
| `src/settings.ts` | 設定項目の追加（frontmatterKeys, showFileName） |
| `src/settings-tab.ts` | **新規**: 設定タブUI（PluginSettingTab） |
| `src/topic-view.ts` | frontmatter表示、ファイル名表示切り替えの実装 |
| `src/main.ts` | 設定タブの登録 |
| `src/frontmatter.ts` | **新規**: frontmatter解析ユーティリティ |
| `styles.css` | frontmatter表示用スタイル追加 |

---

## 4. データモデル設計

### 4.1 設定データ（TopicLineSettings）

```typescript
interface TopicLineSettings {
  /** 表示するfrontmatterキーのリスト */
  frontmatterKeys: string[];

  /** ファイル名を表示するか */
  showFileName: boolean;
}

const DEFAULT_SETTINGS: TopicLineSettings = {
  frontmatterKeys: [],
  showFileName: false,
};
```

### 4.2 永続化データ構造

設定データはトピックデータとは別に保存する。現行のTopicDataとの共存を考慮し、以下の構造とする:

```typescript
// saveData/loadDataで保存されるデータ
interface PluginData {
  version: 1;
  topics: Topic[];
  settings: TopicLineSettings;
}
```

**移行考慮**: 既存データ（`TopicData`のみ）がある場合は、`settings`フィールドが存在しないため、デフォルト設定を適用する。

---

## 5. コンポーネント設計

### 5.1 設定タブ（TopicLineSettingTab）

**ファイル**: `src/settings-tab.ts`

```typescript
class TopicLineSettingTab extends PluginSettingTab {
  plugin: TopicLinePlugin;

  constructor(app: App, plugin: TopicLinePlugin);
  display(): void;
}
```

**UI構成**:

1. **Frontmatter表示キー設定**
   - テキストエリア入力（1行に1キー、または カンマ区切り）
   - プレースホルダー: `status, tags, priority`
   - 説明文: "Enter frontmatter keys to display (comma-separated or one per line)"

2. **ファイル名表示切り替え**
   - トグルスイッチ
   - ラベル: "Show file name"
   - 説明文: "Display the source file name for each topic"

### 5.2 Frontmatter解析（frontmatter.ts）

**ファイル**: `src/frontmatter.ts`

```typescript
/**
 * ファイルのfrontmatterから指定キーの値を取得する
 * @param app Obsidian App インスタンス
 * @param filePath ファイルパス
 * @param keys 取得するキーのリスト
 * @returns キーと値のマップ（存在しないキーは含まない）
 */
function getFrontmatterValues(
  app: App,
  filePath: string,
  keys: string[]
): Map<string, string>;

/**
 * frontmatter値を表示用文字列にフォーマットする
 * 配列はカンマ区切りで連結
 */
function formatFrontmatterValue(value: unknown): string;
```

**Obsidian API活用**:
- `app.metadataCache.getFileCache(file)?.frontmatter` を使用
- メタデータキャッシュはObsidianが自動管理するため、ファイル変更時も自動更新

### 5.3 トピックビュー拡張（topic-view.ts）

**変更点**:

1. `renderTopicItem()` メソッドの拡張
   - frontmatter情報の取得と表示
   - `showFileName` 設定に基づくファイル名表示制御

2. 設定変更時の再描画
   - `plugin.settings` の変更を検知して `render()` を呼び出す

**UI要素追加**:

```
.topic-item
├── .topic-number        # 番号（既存）
├── .topic-content-wrapper
│   ├── .topic-content   # 内容（既存）
│   ├── .topic-frontmatter  # [新規] frontmatter情報
│   ├── .topic-file-info # ファイル名（条件付き表示）
│   └── .topic-alert     # アラート（既存）
└── .topic-actions       # 削除ボタン（既存）
```

---

## 6. 処理フロー

### 6.1 設定変更フロー

```
┌─────────────────────────────────────────────────────────────────┐
│ ユーザーが設定画面で値を変更                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ TopicLineSettingTab.onChange()                                  │
│ - plugin.settings を更新                                        │
│ - plugin.saveSettings() を呼び出し                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ TopicView.render() が再実行される                               │
│ - 新しい設定値でfrontmatter/ファイル名表示を更新               │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Frontmatter表示フロー

```
┌─────────────────────────────────────────────────────────────────┐
│ TopicView.renderTopicItem() 実行時                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ plugin.settings.frontmatterKeys が空でないか確認               │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼ (空)                          ▼ (キーあり)
    ┌─────────────────┐          ┌─────────────────────────────┐
    │ 何も表示しない  │          │ getFrontmatterValues()     │
    └─────────────────┘          │ でfrontmatter値を取得       │
                                 └─────────────────────────────┘
                                              │
                                              ▼
                                 ┌─────────────────────────────┐
                                 │ 各キーについて:              │
                                 │ - 値が存在 → 表示           │
                                 │ - 値がない → スキップ       │
                                 │ - 配列 → カンマ区切り       │
                                 └─────────────────────────────┘
```

---

## 7. スタイル設計

### 7.1 追加CSSクラス

```css
/* Frontmatter情報表示 */
.topic-frontmatter {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: 4px;
}

.topic-frontmatter-item {
  font-size: 0.85em;
  color: var(--text-muted);
  background-color: var(--background-secondary);
  padding: 1px 6px;
  border-radius: 4px;
}

.topic-frontmatter-key {
  color: var(--text-faint);
}

.topic-frontmatter-value {
  color: var(--text-muted);
}
```

### 7.2 テーマ互換性

- すべての色指定にObsidian CSS変数を使用
- ライト/ダークテーマ両対応
- カスタムテーマでも適切に表示

---

## 8. API設計

### 8.1 設定関連メソッド（main.ts）

```typescript
class TopicLinePlugin extends Plugin {
  // 既存
  settings: TopicLineSettings;
  async loadSettings(): Promise<void>;
  async saveSettings(): Promise<void>;

  // 追加: 設定変更通知用
  private settingsChangeCallbacks: Array<() => void>;
  onSettingsChange(callback: () => void): void;
  offSettingsChange(callback: () => void): void;
  private notifySettingsChange(): void;
}
```

### 8.2 Frontmatterユーティリティ（frontmatter.ts）

```typescript
/**
 * ファイルのfrontmatterから指定キーの値を取得する
 */
export function getFrontmatterValues(
  app: App,
  filePath: string,
  keys: string[]
): Map<string, string>;

/**
 * 設定文字列をキー配列にパースする
 * カンマ区切りまたは改行区切りに対応
 */
export function parseFrontmatterKeys(input: string): string[];
```

---

## 9. エラーハンドリング

| シナリオ | 対応 |
|---|---|
| ファイルが存在しない | frontmatter取得をスキップ、既存のアラート表示 |
| frontmatterが存在しない | 空のMapを返す（何も表示しない） |
| 指定キーが存在しない | そのキーをスキップ |
| frontmatter値が複雑なオブジェクト | JSON.stringify でフォールバック |

---

## 10. テスト観点

### 10.1 設定画面

- [ ] 設定タブが表示される
- [ ] frontmatterキーを入力・保存できる
- [ ] ファイル名表示トグルが動作する
- [ ] 設定がObsidian再起動後も保持される

### 10.2 Frontmatter表示

- [ ] 指定キーの値が表示される
- [ ] 存在しないキーは表示されない
- [ ] 配列値がカンマ区切りで表示される
- [ ] 複数キー指定時、指定順に表示される
- [ ] frontmatterがないファイルでもエラーにならない

### 10.3 ファイル名表示切り替え

- [ ] デフォルトでファイル名が非表示
- [ ] ONにするとファイル名が表示される
- [ ] OFFにするとファイル名が非表示になる
- [ ] 設定変更が即座に反映される

---

## 11. 実装順序

1. **Phase 1: 設定インフラ**
   - `settings.ts` の拡張（新しい設定項目追加）
   - `main.ts` のデータ読み込み/保存ロジック調整

2. **Phase 2: 設定画面**
   - `settings-tab.ts` の新規作成
   - `main.ts` に設定タブ登録

3. **Phase 3: Frontmatter機能**
   - `frontmatter.ts` の新規作成
   - `topic-view.ts` にfrontmatter表示を追加
   - `styles.css` にスタイル追加

4. **Phase 4: ファイル名表示切り替え**
   - `topic-view.ts` の条件付き表示実装

---

## 12. 変更履歴

| 日付 | バージョン | 変更内容 |
|---|---|---|
| 2026-01-10 | 1.0 | 初版作成（FR-010〜FR-012対応設計） |
