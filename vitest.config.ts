import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		exclude: ["node_modules", "vault.local"],
	},
	resolve: {
		alias: {
			obsidian: new URL("./src/__mocks__/obsidian.ts", import.meta.url)
				.pathname,
		},
	},
});
