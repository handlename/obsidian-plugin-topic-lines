# Changelog

## [2.0.0](https://github.com/handlename/obsidian-plugin-topic-lines/compare/1.2.2...2.0.0) - 2026-04-25
- feat: slot-based topic management (v2.0.0) by @handlename in https://github.com/handlename/obsidian-plugin-topic-lines/pull/20

## [2.0.0] - Unreleased

### Breaking Changes

- Data format changed from a flat topic array (v1) to a slot-based model (v2)
- v1 data is automatically migrated on first load; the migration is **irreversible**
- New per-slot commands (`Set topic to {slotName}`, `Jump to {slotName}`) are dynamically registered per slot
- `Jump to topic 1`–`Jump to topic 9` (IDs `jump-to-topic-1` through `jump-to-topic-9`) are retained as position-based commands; existing v1 hotkey bindings continue to work and now navigate to the topic in the slot at that position
- Drag-and-drop reordering in the sidebar is removed (slot order is managed in settings)
- Minimum Obsidian version is now `1.7.2` (required for `Plugin.removeCommand` API used during slot CRUD)

### Added

- Slot-based topic organization (1–20 named slots, default 3: `slot1`, `slot2`, `slot3`)
- `Set topic to {slotName}` command for each slot (dynamically registered)
- `Jump to {slotName}` command for each slot (dynamically registered)
- `Collision mode` setting: choose between `Confirm before overwrite` and `Overwrite without confirmation`
- Settings UI for slot management (add, delete, rename, reorder via up/down buttons)
- Empty slot placeholders shown in the sidebar
- Confirmation modal before `Clear all topics` (in both command palette and sidebar menu)
- Pre-migration v1 data dumped to `console.debug` for power-user recovery

### Changed

- `Register selected lines` now assigns the topic to the first empty slot. If all slots are full, a notice is shown and nothing is registered.
- `Clear all topics` clears all slot contents but preserves the slots themselves
- Sidebar always displays all slots in their configured order, with a vertical layout: slot name, topic content, source filename
- Slot rename / reorder / add / remove now refresh per-slot commands in place — no plugin restart required
- Plugin version bumped to `2.0.0`

## [1.2.2](https://github.com/handlename/obsidian-plugin-topic-lines/compare/1.2.1...1.2.2) - 2026-04-24
- Introduce domain glossary and align naming by @handlename in https://github.com/handlename/obsidian-plugin-topic-lines/pull/18

## [1.2.1](https://github.com/handlename/obsidian-plugin-topic-lines/compare/1.2.0...1.2.1) - 2026-01-24
- fix: prevent duplicate topic registration on same line by @handlename in https://github.com/handlename/obsidian-plugin-topic-lines/pull/15
- docs: replace screenshot with screencast GIF by @handlename in https://github.com/handlename/obsidian-plugin-topic-lines/pull/17

## [1.2.0](https://github.com/handlename/obsidian-plugin-topic-lines/compare/1.1.0...1.2.0) - 2026-01-23
- refactor: rename commands for clarity by @handlename in https://github.com/handlename/obsidian-plugin-topic-lines/pull/12
- feat: add unregister-topic command by @handlename in https://github.com/handlename/obsidian-plugin-topic-lines/pull/11
- feat: add Jump to topic 4-9 commands by @handlename in https://github.com/handlename/obsidian-plugin-topic-lines/pull/14

## [1.1.0](https://github.com/handlename/obsidian-plugin-topic-lines/compare/1.0.0...1.1.0) - 2026-01-17
- fix: display indented list items correctly in sidebar by @handlename in https://github.com/handlename/obsidian-plugin-topic-lines/pull/5
- feat: register current line as topic when no selection by @handlename in https://github.com/handlename/obsidian-plugin-topic-lines/pull/7
- feat: add clear all topics command and sidebar menu by @handlename in https://github.com/handlename/obsidian-plugin-topic-lines/pull/8
- feat: add toggle register topic command by @handlename in https://github.com/handlename/obsidian-plugin-topic-lines/pull/9
- test: add vitest and unit tests for utils by @handlename in https://github.com/handlename/obsidian-plugin-topic-lines/pull/10

## [1.0.0](https://github.com/handlename/obsidian-plugin-topic-lines/commits/1.0.0) - 2026-01-09
- docs: rewrite README for Topic Lines plugin by @handlename in https://github.com/handlename/obsidian-plugin-topic-lines/pull/2
- fix: remove command from .tagpr to fix release workflow by @handlename in https://github.com/handlename/obsidian-plugin-topic-lines/pull/4

## [1.0.0](https://github.com/handlename/obsidian-plugin-topic-lines/commits/1.0.0) - 2026-01-09
- docs: rewrite README for Topic Lines plugin by @handlename in https://github.com/handlename/obsidian-plugin-topic-lines/pull/2

## [Unreleased]

## [1.0.0] - 2026-01-09

### Added

- Initial release
- Topic registration from selected lines (FR-001)
- Topic list display in sidebar (FR-002)
- Click-to-jump navigation (FR-003)
- Command-based jump for topics 1-3 (FR-004)
- Topic deletion (FR-005)
- Drag-and-drop reordering (FR-006)
- Data persistence (FR-007)
- Alert display when source file is missing (FR-008)
- Topic content tracking with block IDs (FR-009)
