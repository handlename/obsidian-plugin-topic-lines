# 技術設計書: Obsidian Plugin Topic Lines

## 1. 概要

本ドキュメントは、REQUIREMENTS.mdに定義された要件に基づき、Obsidian Plugin Topic Linesの技術設計を記述する。

---

## 2. 技術スタック

### 2.1 採用技術

| 技術 | バージョン/詳細 | 選定理由 |
|------|----------------|----------|
| TypeScript | ^5.8.3 | 型安全性の確保、IDEサポート、Obsidian公式推奨 |
| esbuild | 0.25.5 | 高速ビルド、Obsidianサンプルプラグイン標準構成 |
| npm | - | パッケージ管理、サンプルプラグイン標準構成 |
| Obsidian API | latest | プラグイン開発に必須 |
| ESLint | 9.x | コード品質維持、eslint-plugin-obsidianmd による Obsidian 固有ルール適用 |

### 2.2 不採用技術と理由

| 技術 | 不採用理由 |
|------|-----------|
| React/Preact | サイドバービューはシンプルなリスト表示のみ。Obsidian標準のDOM APIで十分であり、追加の依存関係とバンドルサイズ増加を避ける |
| Rollup | esbuildがサンプルプラグインの標準であり、十分な機能を持つ。変更の必要なし |
| yarn/pnpm | npmがサンプルプラグインの標準。互換性を優先 |
| Svelte | 学習コストと依存関係の増加に対し、本プラグインのUI複雑度では不要 |
| CSS-in-JS | styles.cssによる標準的なスタイリングで十分。Obsidianテーマとの互換性を維持しやすい |

---

## 3. アーキテクチャ

### 3.1 モジュール構成

```
src/
├── main.ts              # プラグインエントリポイント（ライフサイクル管理のみ）
├── types.ts             # 型定義（Topic, TopicData）
├── settings.ts          # 設定インターフェース、デフォルト値、設定タブ
├── topic-store.ts       # トピックデータの管理（CRUD、永続化）
├── topic-view.ts        # サイドバービュー（ItemView継承）
├── commands.ts          # コマンド登録（登録、ジャンプ、削除）
└── utils.ts             # ユーティリティ関数（ファイル存在確認など）
```

### 3.2 責務分離

| モジュール | 責務 |
|-----------|------|
| main.ts | プラグインライフサイクル（onload/onunload）、各モジュールの初期化と登録 |
| types.ts | データ構造の型定義 |
| settings.ts | プラグイン設定の定義と永続化 |
| topic-store.ts | トピックデータのCRUD操作、永続化、イベント発火 |
| topic-view.ts | サイドバーUIのレンダリング、ユーザーインタラクション処理 |
| commands.ts | コマンドパレットへのコマンド登録 |
| utils.ts | 共通ユーティリティ（ファイル存在確認など） |

---

## 4. データモデル

### 4.1 Topic型

```typescript
interface Topic {
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
```

### 4.2 TopicData型（永続化用）

```typescript
interface TopicData {
  /** データフォーマットバージョン（将来の移行用） */
  version: 1;
  
  /** トピック配列（表示順） */
  topics: Topic[];
}
```

### 4.3 設計判断

- **行番号の保持**: 元ノートの行番号を保持し、ジャンプ時に使用する。ノート更新時の追従はリアルタイム監視で対応
- **originalContentの保持**: 元ノートが編集された場合の差分検出、およびノート削除時の表示に使用
- **UUID使用**: 並び替え・削除時の一意識別に必要。順序に依存しない識別子
- **version フィールド**: 将来のデータ構造変更に備えたマイグレーション対応

---

## 5. コンポーネント設計

### 5.1 TopicLinePlugin（main.ts）

```typescript
class TopicLinePlugin extends Plugin {
  settings: TopicLineSettings;
  topicStore: TopicStore;
  
  async onload(): Promise<void>;
  async onunload(): Promise<void>;
  async loadSettings(): Promise<void>;
  async saveSettings(): Promise<void>;
}
```

**責務**:
- プラグインライフサイクル管理
- TopicStore、TopicView、コマンドの初期化
- 設定の読み込み・保存

### 5.2 TopicStore（topic-store.ts）

```typescript
class TopicStore {
  private plugin: TopicLinePlugin;
  private data: TopicData;
  
  /** トピック一覧取得 */
  getTopics(): Topic[];
  
  /** トピック追加（最大20件制限） */
  addTopic(topic: Omit<Topic, 'id' | 'createdAt'>): Promise<Topic | null>;
  
  /** トピック削除 */
  removeTopic(id: string): Promise<void>;
  
  /** トピック並び替え */
  reorderTopics(fromIndex: number, toIndex: number): Promise<void>;
  
  /** トピック内容更新（元ノート変更時） */
  updateTopicContent(id: string, content: string): Promise<void>;
  
  /** データ読み込み */
  load(): Promise<void>;
  
  /** データ保存 */
  save(): Promise<void>;
  
  /** 変更通知用コールバック登録 */
  onChange(callback: () => void): void;
}
```

**設計判断**:
- データ変更時はコールバックでビューに通知（Observer パターン）
- 永続化は `Plugin.saveData()` / `Plugin.loadData()` を使用
- トピック数上限（20件）はaddTopic内でチェック

### 5.3 TopicView（topic-view.ts）

```typescript
class TopicView extends ItemView {
  static readonly VIEW_TYPE = 'topic-lines-view';
  
  private plugin: TopicLinePlugin;
  private containerEl: HTMLElement;
  
  getViewType(): string;
  getDisplayText(): string;
  getIcon(): string;
  
  async onOpen(): Promise<void>;
  async onClose(): Promise<void>;
  
  /** ビュー再描画 */
  render(): void;
  
  /** 個別トピックアイテムの描画 */
  private renderTopicItem(topic: Topic, index: number): HTMLElement;
  
  /** ドラッグ&ドロップ設定 */
  private setupDragAndDrop(): void;
}
```

**UI構造**:
```
topic-lines-container
├── topic-item (data-topic-id="xxx")
│   ├── topic-number ("1")
│   ├── topic-content (複数行テキスト)
│   ├── topic-file-info (ファイル名、控えめ表示)
│   ├── topic-alert (元ノート不在時のみ表示)
│   └── topic-actions
│       └── delete-button
├── topic-item ...
└── ...
```

**設計判断**:
- ItemViewを継承し、Obsidian標準のサイドバービューとして実装
- ドラッグ&ドロップはHTML5 Drag and Drop APIを使用
- Obsidianテーマ変数（CSS custom properties）を活用してテーマ互換性を確保

### 5.4 Commands（commands.ts）

```typescript
function registerCommands(plugin: TopicLinePlugin): void;
```

**登録コマンド**:

| コマンドID | 名前 | 説明 |
|-----------|------|------|
| `topic-lines:register-topic` | Register topic | 選択行をトピックとして登録 |
| `topic-lines:jump-to-topic-1` | Jump to topic 1 | トピック1にジャンプ |
| `topic-lines:jump-to-topic-2` | Jump to topic 2 | トピック2にジャンプ |
| `topic-lines:jump-to-topic-3` | Jump to topic 3 | トピック3にジャンプ |
| `topic-lines:show-topic-view` | Show topic lines | サイドバービューを表示 |

**設計判断**:
- ジャンプコマンドは要件に従い1〜3の3つのみ
- 登録コマンドは `editorCallback` を使用し、エディタがアクティブな場合のみ有効
- ジャンプコマンドは `callback` を使用（どこからでも実行可能）

---

## 6. 処理フロー

### 6.1 トピック登録フロー

```
1. ユーザーがエディタで行を選択
2. コマンドパレットから「Register topic」を実行
3. editorCallback が発火
4. Editor.getSelection() で選択テキスト取得
5. Editor.getCursor() で行番号取得
6. TopicStore.addTopic() を呼び出し
   - 20件上限チェック
   - UUID生成
   - データ保存
   - onChange コールバック発火
7. TopicView.render() が呼ばれ、ビュー更新
8. Notice で登録完了を通知
```

### 6.2 トピックジャンプフロー（クリック）

```
1. ユーザーがサイドバーのトピックをクリック
2. clickイベントハンドラが発火
3. topic.filePath からファイル存在確認
   - 存在しない場合: Notice でエラー表示、処理終了
4. workspace.openLinkText() でファイルを開く
5. editor.setCursor() でカーソル位置を設定
6. editor.scrollIntoView() で該当行を表示
```

### 6.3 元ノート変更追従フロー

```
1. vault.on('modify') イベント登録
2. 変更されたファイルがトピックの元ノートか確認
3. 該当する場合:
   - ファイル内容を読み込み
   - 該当行の内容を取得
   - TopicStore.updateTopicContent() で更新
   - TopicView.render() でビュー更新
```

### 6.4 元ノート削除/移動検出フロー

```
1. vault.on('delete') / vault.on('rename') イベント登録
2. 削除/移動されたファイルがトピックの元ノートか確認
3. 該当する場合:
   - delete: トピックの存在フラグを更新
   - rename: topic.filePath を新パスに更新
4. TopicView.render() でビュー更新（アラート表示）
```

---

## 7. イベント処理

### 7.1 登録するイベント

| イベント | 処理内容 |
|----------|----------|
| `vault.on('modify')` | 元ノート変更時のトピック内容更新 |
| `vault.on('delete')` | 元ノート削除時のアラート表示 |
| `vault.on('rename')` | 元ノート移動/リネーム時のパス更新 |

### 7.2 イベント登録の注意点

- すべてのイベントは `this.registerEvent()` で登録し、アンロード時の自動解除を保証
- `workspace.onLayoutReady()` 内で登録し、起動時の不要な発火を防止
- イベントハンドラ内では `layoutReady` チェックを追加

---

## 8. UI/UXデザイン

### 8.1 サイドバービュー

**レイアウト**:
```
┌─────────────────────────────┐
│ Topic Lines            [≡] │  ← ヘッダー（ドラッグでドッキング変更可能）
├─────────────────────────────┤
│ 1. First line of topic     │  ← トピック1
│    Second line...          │
│    notes/meeting.md        │  ← ファイル名（グレー、小さめ）
├─────────────────────────────┤
│ 2. Another topic content   │  ← トピック2
│    journal/2024-01.md      │
├─────────────────────────────┤
│ 3. ⚠ File not found        │  ← トピック3（元ノート不在）
│    deleted-file.md         │
└─────────────────────────────┘
```

### 8.2 スタイリング方針

- Obsidianテーマ変数を最大限活用
- カスタムスタイルは `styles.css` に最小限で定義
- ダークモード/ライトモード両対応はテーマ変数により自動対応

**主要CSS変数**:
```css
var(--text-normal)        /* 通常テキスト */
var(--text-muted)         /* 補足テキスト（ファイル名） */
var(--text-warning)       /* 警告テキスト */
var(--background-primary) /* 背景色 */
var(--interactive-hover)  /* ホバー時背景 */
```

### 8.3 アクセシビリティ

- ドラッグハンドルにaria-labelを付与
- 削除ボタンにaria-labelを付与
- フォーカス可能な要素にキーボードナビゲーション対応

---

## 9. エラーハンドリング

### 9.1 エラーケース一覧

| ケース | 対応 |
|--------|------|
| トピック登録時に上限（20件）超過 | Notice でエラー表示、登録をキャンセル |
| ジャンプ時に元ノートが存在しない | Notice でエラー表示、サイドバーにアラート表示 |
| データ読み込み失敗 | デフォルト値（空配列）で初期化、コンソールにエラーログ |
| データ保存失敗 | Notice でエラー表示、コンソールにエラーログ |

### 9.2 エラーメッセージ

| 状況 | メッセージ |
|------|-----------|
| 上限超過 | "Cannot add topic: maximum limit (20) reached" |
| ファイル不在 | "File not found: {filename}" |
| 保存失敗 | "Failed to save topic data" |

---

## 10. パフォーマンス考慮

### 10.1 起動時

- `onload()` では最小限の処理のみ実行
- ビューの初期化は `workspace.onLayoutReady()` 後に遅延
- データ読み込みは非同期で実行

### 10.2 実行時

- 元ノート変更イベントはデバウンス（300ms）を適用
- ビュー再描画は必要な場合のみ実行（差分検出は行わず全再描画、トピック数が最大20件のため問題なし）

### 10.3 メモリ

- トピック数上限（20件）により、メモリ使用量は一定範囲に収まる
- 不要な参照は明示的にnull代入してGC対象に

---

## 11. テスト方針

### 11.1 手動テスト項目

| 機能 | テスト内容 |
|------|-----------|
| トピック登録 | 単一行/複数行選択での登録、上限到達時の動作 |
| トピック表示 | 番号表示、内容全文表示、ファイル名表示 |
| クリックジャンプ | 正常ジャンプ、ファイル不在時のエラー |
| コマンドジャンプ | トピック1〜3へのジャンプ、該当トピック不在時 |
| 削除 | 削除後の番号再採番 |
| 並び替え | ドラッグ&ドロップ、番号再採番 |
| 永続化 | Obsidian再起動後のデータ保持 |
| 元ノート追従 | 内容変更時の表示更新 |
| 元ノート不在 | 削除時のアラート表示 |
| テーマ | ライト/ダークテーマでの表示 |

### 11.2 自動テスト

本プラグインはObsidian環境に強く依存するため、自動テストは限定的に実施:
- 型チェック: `tsc --noEmit`
- リント: `eslint`
- 純粋関数のユニットテスト（将来的にvitest導入を検討）

---

## 12. 将来の拡張ポイント

以下は現時点では実装しないが、データ構造やアーキテクチャで考慮しておく項目:

| 項目 | 考慮事項 |
|------|----------|
| トピック数上限の設定化 | settings.tsに設定項目を追加可能な構造 |
| ジャンプコマンド数の拡張 | commands.tsでループ生成可能な構造 |
| トピックのエクスポート/インポート | TopicData構造がJSON互換 |
| 検索機能 | TopicStore.getTopics()で全件取得可能 |

---

## 13. ファイル一覧と依存関係

```
src/
├── main.ts          [TopicLinePlugin]
│   ├── imports: settings.ts, topic-store.ts, topic-view.ts, commands.ts
│   └── exports: TopicLinePlugin (default)
│
├── types.ts         [Topic, TopicData]
│   └── exports: Topic, TopicData
│
├── settings.ts      [TopicLineSettings, DEFAULT_SETTINGS, TopicLineSettingTab]
│   ├── imports: types.ts
│   └── exports: TopicLineSettings, DEFAULT_SETTINGS, TopicLineSettingTab
│
├── topic-store.ts   [TopicStore]
│   ├── imports: types.ts
│   └── exports: TopicStore
│
├── topic-view.ts    [TopicView]
│   ├── imports: types.ts, topic-store.ts, utils.ts
│   └── exports: TopicView
│
├── commands.ts      [registerCommands]
│   ├── imports: types.ts, topic-store.ts, topic-view.ts
│   └── exports: registerCommands
│
└── utils.ts         [ユーティリティ関数]
    └── exports: fileExists, generateUUID, etc.
```

---

## 14. 変更履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|------|-----------|----------|--------|
| 2026-01-09 | 1.0 | 初版作成 | - |
