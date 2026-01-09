import { App, PluginSettingTab, Setting } from "obsidian";
import type TopicLinePlugin from "./main";
import { parseFrontmatterKeys } from "./frontmatter";

/**
 * キー配列を設定文字列に変換する
 */
function formatFrontmatterKeys(keys: string[]): string {
	return keys.join(", ");
}

/**
 * プラグイン設定タブ
 */
export class TopicLineSettingTab extends PluginSettingTab {
	plugin: TopicLinePlugin;

	constructor(app: App, plugin: TopicLinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Frontmatter keys")
			.setDesc(
				"Enter frontmatter keys to display with each topic (comma-separated or one per line)",
			)
			.addText((text) =>
				text
					.setPlaceholder("Status, tags, priority")
					.setValue(
						formatFrontmatterKeys(
							this.plugin.settings.frontmatterKeys,
						),
					)
					.onChange(async (value) => {
						this.plugin.settings.frontmatterKeys =
							parseFrontmatterKeys(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Show file name")
			.setDesc("Display the source file name for each topic")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showFileName)
					.onChange(async (value) => {
						this.plugin.settings.showFileName = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
