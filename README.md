# Topic Lines

[日本語](README.ja.md)

An Obsidian plugin that lets you pin specific lines from your notes as topics in a sidebar for quick access and navigation.

![Screenshot](docs/images/screenshot.png)

## Features

- **Register topics**: Select any text in your notes and register it as a topic
- **Sidebar view**: Access all your registered topics from a dedicated sidebar panel
- **Quick navigation**: Click a topic to jump directly to that line in the source file
- **Keyboard shortcuts**: Jump to topics 1-9 using customizable hotkeys
- **Drag and drop reordering**: Reorganize your topics by dragging them in the sidebar
- **Markdown rendering**: Topics display with full Markdown formatting
- **Frontmatter display**: Optionally show frontmatter values alongside topics
- **File tracking**: Topics automatically update when their source file is renamed
- **Mobile support**: Works on both desktop and mobile devices

## Usage

### Registering a topic

1. Open a note and select the text you want to register as a topic (or place cursor on a line)
2. Open the command palette (Cmd/Ctrl + P)
3. Run the command **Topic Lines: Register selected lines**

The selected text (or current line) will be saved and appear in the sidebar.

### Toggling a topic

1. Place your cursor on a line that you want to register or unregister as a topic
2. Open the command palette (Cmd/Ctrl + P)
3. Run the command **Topic Lines: Toggle current line**

If the line is already registered as a topic, it will be unregistered. Otherwise, it will be registered as a new topic.

### Viewing topics

Run the command **Topic Lines: Show sidebar** or click the sidebar icon to open the topic list.

### Navigating to a topic

- Click any topic in the sidebar to jump to its location in the source file
- Use the commands **Topic Lines: Jump to topic 1-9** for quick keyboard navigation

### Deleting a topic

Hover over a topic in the sidebar and click the × button to remove it.

### Reordering topics

Drag and drop topics in the sidebar to change their order.

## Settings

Access settings via **Settings → Community plugins → Topic Lines**.

- **Frontmatter keys**: Specify frontmatter keys to display alongside topics (comma-separated)
- **Show file name**: Toggle displaying the source file name under each topic

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
| Register selected lines | Register selected text (or current line) as a topic |
| Unregister selected lines | Unregister topics on selected lines (or current line) |
| Toggle current line | Toggle registration of the current line as a topic |
| Show sidebar | Open the topic list sidebar |
| Jump to topic 1 | Navigate to the first topic |
| Jump to topic 2 | Navigate to the second topic |
| Jump to topic 3 | Navigate to the third topic |
| Jump to topic 4 | Navigate to the fourth topic |
| Jump to topic 5 | Navigate to the fifth topic |
| Jump to topic 6 | Navigate to the sixth topic |
| Jump to topic 7 | Navigate to the seventh topic |
| Jump to topic 8 | Navigate to the eighth topic |
| Jump to topic 9 | Navigate to the ninth topic |
| Clear all topics | Remove all registered topics |

## License

0-BSD
