import { App, PluginSettingTab } from "obsidian";
import type TopicLinePlugin from "./main";

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
	}
}
