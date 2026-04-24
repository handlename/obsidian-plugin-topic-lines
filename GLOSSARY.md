# GLOSSARY

This glossary defines domain-specific terms used in the Topic Lines Obsidian plugin. It serves as a reference for both developers working on the plugin and users who want to understand the concepts behind it.

## Core Concepts

### Topic

A pinned reference to a specific line or range of lines in a note. A topic preserves the source file path, the line range, the original text content at registration time, a block ID anchor, and a creation timestamp. Topics are the primary domain entity of the plugin.

### Topic Line Range

The contiguous range of lines that make up a single topic, represented by a start line and an inclusive end line (both 0-indexed). When a user selects multiple lines before registering, all lines in the selection become part of the same topic. When the cursor is on a single line without a selection, the range covers just that line.

### Block ID

An Obsidian block reference identifier (e.g. `^abc123`) attached to the first line of a topic's range in the source note. The block ID serves as a stable anchor that survives edits above the topic, allowing the plugin to find the topic's location even when line numbers shift.

### Source File

The note file from which a topic was registered. A topic remembers the vault-relative path of its source file. When the source file is renamed or moved within the vault, the plugin updates the topic so navigation continues to work.

### Topic Registration

The action of marking a selection (or the current line) as a topic. Invoked via the **Topic Lines: Register selected lines** command. Registration assigns a new block ID to the source line if one does not already exist, captures the current text as the topic's original content, and appends the topic to the sidebar list.

### Topic Toggle

A shortcut action that registers the current line as a topic if it is not already registered, or unregisters it if it is. Invoked via the **Topic Lines: Toggle current line** command. Provides a single keystroke for the common "pin/unpin this line" workflow.

## Sidebar & Interaction

### Sidebar View

The dedicated Obsidian panel that lists all registered topics. Opened via the **Topic Lines: Show sidebar** command or by clicking the plugin's ribbon icon. The sidebar is the primary user interface for browsing, navigating, reordering, and deleting topics.

### Topic List

The ordered sequence of topics displayed in the sidebar. The order is user-controlled via drag and drop and determines which topic is addressed by "Jump to topic N" commands.

### Jump

Navigating from the sidebar to the source line of a topic. Triggered by clicking a topic entry or by running the **Topic Lines: Jump to topic 1-9** commands. The plugin opens the source file (if not already active) and scrolls the editor to the topic's location.

### Numbered Jump Commands

Nine distinct commands (**Jump to topic 1** through **Jump to topic 9**) that each navigate to the topic at the corresponding position in the topic list. Designed to be bound to keyboard shortcuts for quick access to frequently used topics.

### Drag and Drop Reordering

The interaction for changing the order of topics in the sidebar by dragging a topic entry to a new position. The new order is persisted immediately and affects which topic each numbered jump command targets.

### Topic Deletion

Removing a single topic from the topic list. Performed by hovering over a topic entry in the sidebar and clicking the × button. Deletion does not modify the source note; it only removes the sidebar entry. The block ID that was added to the source remains in place.

### Clear All Topics

A bulk action that removes every registered topic at once, invoked via the **Topic Lines: Clear all topics** command.

## Persistence & Settings

### Topic Store

The internal module responsible for loading, saving, and mutating topics. It mediates all CRUD operations on the topic list and notifies subscribers (such as the sidebar view) when the list changes so the UI can re-render.

### Topic Data

The persisted representation of the topic list. Stored via Obsidian's plugin data API as a versioned object containing the topic array. The version field exists to support future data migrations.

### Topic Limit

An upper bound on the number of topics that can be registered at once (currently 20). Keeps the sidebar focused and prevents runaway growth of persisted data.

### Frontmatter Keys Setting

A user setting (comma-separated list) that specifies which Frontmatter keys from the source note should be displayed alongside each topic in the sidebar. When configured, the values of these keys are rendered under the topic text, providing additional context such as status, tags, or category.

### Show File Name Setting

A user setting that toggles whether the source file's name is displayed beneath each topic in the sidebar.

## Obsidian Concepts

### Frontmatter

YAML metadata at the top of an Obsidian note, delimited by `---` lines. Topic Lines reads Frontmatter values from a topic's source file to display them in the sidebar when the corresponding Frontmatter Keys Setting is configured.

### Command Palette

Obsidian's command search interface, opened with Cmd/Ctrl + P. Topic Lines registers all of its user-facing actions (register, toggle, jump, show sidebar, clear all) as commands so they can be invoked from the Command Palette and bound to hotkeys.

### Markdown Rendering

Obsidian's facility for rendering Markdown source as formatted text. Topics are rendered through this facility in the sidebar, so formatting such as bold, italics, links, and inline code appears as it would in the source note rather than as raw Markdown.

### File Tracking

Obsidian's mechanism for notifying plugins when a file is renamed or moved within the vault. Topic Lines listens for these events and updates each affected topic's stored file path so that jump actions continue to locate the source correctly.
