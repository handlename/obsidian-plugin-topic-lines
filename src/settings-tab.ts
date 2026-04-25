import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type TopicLinePlugin from "./main";
import { parseFrontmatterKeys } from "./frontmatter";
import { cleanupTopicBlockId } from "./commands";
import {
	CollisionMode,
	SLOT_LIMIT,
	SLOT_MIN,
	SLOT_NAME_MAX_LENGTH,
} from "./types";

function formatFrontmatterKeys(keys: string[]): string {
	return keys.join(", ");
}

/**
 * プラグイン設定タブ。
 * frontmatter / showFileName / collisionMode / slot CRUD を提供する。
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

		this.renderGeneralSettings(containerEl);
		this.renderCollisionMode(containerEl);
		this.renderSlotsSection(containerEl);
	}

	private renderGeneralSettings(containerEl: HTMLElement): void {
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

	private renderCollisionMode(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Collision mode")
			.setDesc(
				"Behavior when setting a topic to an occupied slot via per-slot command",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("confirm", "Confirm before overwrite")
					.addOption("overwrite", "Overwrite without confirmation")
					.setValue(this.plugin.settings.collisionMode)
					.onChange(async (value) => {
						const mode: CollisionMode =
							value === "overwrite" ? "overwrite" : "confirm";
						this.plugin.settings.collisionMode = mode;
						await this.plugin.saveSettings();
					}),
			);
	}

	private renderSlotsSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Slots").setHeading();

		const slots = this.plugin.topicStore.getSlots();

		for (let i = 0; i < slots.length; i++) {
			this.renderSlotRow(containerEl, i, slots);
		}

		new Setting(containerEl)
			.addButton((btn) => {
				btn.setButtonText("Add slot")
					.setDisabled(slots.length >= SLOT_LIMIT)
					.onClick(async () => {
						const ok = await this.plugin.topicStore.addSlot(
							`slot${slots.length + 1}`,
						);
						if (!ok) {
							new Notice(
								`Cannot add slot: maximum (${SLOT_LIMIT}) reached`,
							);
							return;
						}
						this.plugin.refreshSlotCommands();
						this.display();
					});
			});
	}

	private renderSlotRow(
		containerEl: HTMLElement,
		index: number,
		slots: ReturnType<typeof this.plugin.topicStore.getSlots>,
	): void {
		const slot = slots[index];
		if (!slot) return;

		const setting = new Setting(containerEl);
		const errorEl = containerEl.createDiv({
			cls: "topic-lines-slot-error",
		});

		const showError = (message: string) => {
			errorEl.textContent = message;
			errorEl.addClass("is-visible");
		};
		const clearError = () => {
			errorEl.textContent = "";
			errorEl.removeClass("is-visible");
		};

		setting.addText((text) => {
			text.setValue(slot.name).onChange(() => {
				clearError();
			});
			text.inputEl.maxLength = SLOT_NAME_MAX_LENGTH;
			text.inputEl.addEventListener("blur", () => {
				void this.handleSlotRename(index, slot.name, text, showError, clearError);
			});
		});

		setting.addExtraButton((btn) => {
			btn.setIcon("chevron-up")
				.setTooltip("Move up")
				.setDisabled(index === 0)
				.onClick(async () => {
					await this.plugin.topicStore.reorderSlots(index, index - 1);
					this.plugin.refreshSlotCommands();
					this.display();
				});
		});

		setting.addExtraButton((btn) => {
			btn.setIcon("chevron-down")
				.setTooltip("Move down")
				.setDisabled(index === slots.length - 1)
				.onClick(async () => {
					await this.plugin.topicStore.reorderSlots(index, index + 1);
					this.plugin.refreshSlotCommands();
					this.display();
				});
		});

		setting.addExtraButton((btn) => {
			btn.setIcon("trash")
				.setTooltip("Delete slot")
				.setDisabled(slots.length <= SLOT_MIN)
				.onClick(async () => {
					const removedTopic = await this.plugin.topicStore.removeSlot(
						index,
					);
					if (removedTopic) {
						await cleanupTopicBlockId(this.plugin, removedTopic);
					}
					this.plugin.refreshSlotCommands();
					this.display();
				});
		});
	}

	private async handleSlotRename(
		index: number,
		previousName: string,
		text: { getValue: () => string; setValue: (v: string) => void },
		showError: (message: string) => void,
		clearError: () => void,
	): Promise<void> {
		const value = text.getValue();
		const trimmed = value.trim();
		if (trimmed.length === 0) {
			showError("Slot name cannot be empty");
			text.setValue(previousName);
			return;
		}
		if (trimmed.length > SLOT_NAME_MAX_LENGTH) {
			showError(`Slot name exceeds ${SLOT_NAME_MAX_LENGTH} characters`);
			text.setValue(previousName);
			return;
		}
		if (trimmed === previousName) return;
		const ok = await this.plugin.topicStore.renameSlot(index, trimmed);
		if (!ok) {
			showError("Slot rename failed");
			text.setValue(previousName);
			return;
		}
		this.plugin.refreshSlotCommands();
		clearError();
		this.display();
	}
}
