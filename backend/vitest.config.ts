import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Run integration tests sequentially to avoid DB conflicts
    fileParallelism: false,
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts", "src/services/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"],
    },
  },
});
