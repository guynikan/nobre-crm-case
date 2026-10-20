import { defineConfig } from "tsup";

// Workspace packages ship TypeScript sources, so they are bundled; npm dependencies stay external.
// Entry paths mirror src/ so relative paths such as ../../migrations resolve the same way.
export default defineConfig({
  entry: {
    server: "src/server.ts",
    "cli/migrate": "src/cli/migrate.ts",
    "cli/seed": "src/cli/seed.ts",
    "cli/follow-up-run": "src/cli/follow-up-run.ts",
  },
  format: "esm",
  platform: "node",
  target: "node22",
  splitting: false,
  sourcemap: true,
  clean: true,
  noExternal: [/^@nobre\//],
});
