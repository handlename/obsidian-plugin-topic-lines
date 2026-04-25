import { App, Modal, Setting } from "obsidian";

/**
 * 占有 slot 上書き確認用 modal。
 * collisionMode === "confirm" で使用される。
 */
export class ConfirmOverwriteModal extends Modal {
	private slotName: string;
	private onConfirm: () => void;

	constructor(app: App, slotName: string, onConfirm: () => void) {
		super(app);
		this.slotName = slotName;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "Overwrite topic?" });
		contentEl.createEl("p", {
			text: `Slot "${this.slotName}" already has a topic. Overwrite?`,
		});

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Overwrite")
					.setWarning()
					.onClick(() => {
						this.close();
						this.onConfirm();
					}),
			)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close()),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * 全 topic クリア確認用 modal。
 */
export class ConfirmClearAllModal extends Modal {
	private occupiedCount: number;
	private onConfirm: () => void;

	constructor(app: App, occupiedCount: number, onConfirm: () => void) {
		super(app);
		this.occupiedCount = occupiedCount;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "Clear all topics?" });
		contentEl.createEl("p", {
			text: `Clear all topics from ${this.occupiedCount} slot(s)?`,
		});

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Clear all")
					.setWarning()
					.onClick(() => {
						this.close();
						this.onConfirm();
					}),
			)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close()),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
