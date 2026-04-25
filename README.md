# Topic Lines

[日本語](README.ja.md)

An Obsidian plugin that lets you pin specific lines from your notes as topics in named slots, displayed in a sidebar for quick access and navigation.

![Screencast](docs/images/screencast.gif)

> **Note**: The screencast shows the v1 UI. The v2 interface is slot-based; see Usage below for the new workflow.

## Features

- **Slot-based organization**: Assign topics to named slots for structured tracking (1–20 slots, default 3)
- **Sidebar view**: All slots are always visible in your configured order, with empty slots shown as placeholders
- **Per-slot commands**: Set topics to specific slots and jump to any slot directly from the command palette
- **Configurable slots**: Add, remove, rename, and reorder slots from settings
- **Quick navigation**: Click a topic to jump directly to that line in the source file
- **Markdown rendering**: Topics display with full Markdown formatting
- **Frontmatter display**: Optionally show frontmatter values alongside topics
- **File tracking**: Topics automatically follow source-file renames and content shifts
- **Mobile support**: Works on both desktop and mobile devices

## Upgrading from v1

> Back up your vault before upgrading. The v1 → v2 migration is irreversible.

When you load v2 for the first time, your existing v1 topics are automatically migrated:

- Each topic occupies a generated slot (`slot1`, `slot2`, …)
- If you had more than 20 topics, only the first 20 are migrated and you will see a notice for the dropped count
- Existing settings (`Frontmatter keys`, `Show file name`) are preserved
- The new `Collision mode` setting defaults to `Confirm before overwrite`

## Usage

### Registering a topic to the first empty slot

1. Open a note and select the text you want to register as a topic (or place cursor on a line)
2. Open the command palette (Cmd/Ctrl + P)
3. Run **Topic Lines: Register selected lines**

The topic is assigned to the first empty slot in your configured order. If all slots are occupied, you will see "No empty slot available."

### Setting a topic to a specific slot

1. Select the text (or place cursor on a line)
2. Run **Topic Lines: Set topic to {slotName}** for the slot you want
3. If the slot is already occupied:
   - In `Confirm before overwrite` mode (default), a confirmation dialog appears
   - In `Overwrite without confirmation` mode, the topic is replaced silently

### Toggling a topic

Run **Topic Lines: Toggle current line**. If the line is already registered, it is removed; otherwise it is registered to the first empty slot.

### Viewing slots

Run **Topic Lines: Show sidebar** or click the sidebar icon. All slots are listed in order; occupied slots show their topic content, empty slots show `(empty)`.

### Navigating to a topic

- Click a topic in the sidebar to jump to its source file and line
- Use **Topic Lines: Jump to {slotName}** for keyboard navigation (one command per slot, dynamically registered)

### Removing a topic from a slot

Hover over the topic in the sidebar and click the × button. The slot becomes empty; the slot itself remains.

### Managing slots

Open **Settings → Community plugins → Topic Lines → Slots** to:

- **Add** a slot (up to 20)
- **Delete** a slot (down to 1)
- **Rename** a slot (max 50 characters; non-empty)
- **Reorder** slots with the up/down arrows

Slot order, names, and additions/removals are reflected in the sidebar and command palette immediately — no plugin restart required.

### Clearing all topics

Run **Topic Lines: Clear all topics** or use the sidebar menu. A confirmation dialog asks before clearing all occupied slots. Slots themselves are not removed.

## Settings

Access settings via **Settings → Community plugins → Topic Lines**.

- **Frontmatter keys**: Frontmatter keys to display alongside topics (comma-separated)
- **Show file name**: Display the source file name under each topic
- **Collision mode**: Behavior when setting a topic to an occupied slot via per-slot command (`Confirm before overwrite` / `Overwrite without confirmation`)
- **Slots**: Add, remove, rename, and reorder slots

## Installation

### Using BRAT

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Open **Settings → BRAT → Add Beta plugin**
3. Enter `handlename/obsidian-plugin-topic-lines`
4. Select **Add Plugin**
5. Enable the plugin in **Settings → Community plugins**

## Commands

| Command | Description |
|---------|-------------|
| Register selected lines | Register selected text (or current line) as a topic in the first empty slot |
| Unregister selected lines | Clear topics on selected lines (or current line) from their slots |
| Toggle current line | Toggle topic registration on the current line |
| Show sidebar | Open the topic list sidebar |
| Set topic to {slotName} | Set the selected text (or current line) as a topic in the named slot (one command per slot, dynamically registered) |
| Jump to {slotName} | Navigate to the topic in the named slot (one command per slot, dynamically registered) |
| Jump to topic 1–9 | Navigate to the topic in the slot at position N (fixed 1–9, position-based; coexists with `Jump to {slotName}` and preserves v1 hotkey bindings) |
| Clear all topics | Remove all topics from all slots (slots themselves remain) |

## Known Limitations

- **Per-slot command IDs are position-based**: Hotkeys bound to `Set topic to slot1` follow position, not name. If you reorder slots, the hotkey points to whichever slot is now first.

## License

0-BSD
