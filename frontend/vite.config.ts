import { defineConfig } from "vite";
import { transform } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(fileURLToPath(import.meta.url));
const shipped = [
  "assets/world-v2.webp", "assets/world-ice-v1.webp", "assets/world-desert-v1.webp", "assets/world-cloud-v1.webp",
  "assets/yacht-v2.webp", "assets/captain-v3.webp", "assets/streamlit-mark.svg",
  ...["1-1", "2-1", "3-1"].flatMap(id => ["ogg", "mp3"].map(ext => `assets/music/course-${id}-loop.${ext}`)),
  "licenses/Phaser-MIT.txt",
];
export default defineConfig({
  base: "./",
  plugins: [{
    name: "copy-approved-public-assets",
    apply: "build",
    closeBundle() {
      for (const file of shipped) {
        const destination = resolve(root, "../sky_sailer/frontend/build", file);
        mkdirSync(dirname(destination), { recursive: true });
        copyFileSync(resolve(root, "public", file), destination);
      }
    },
  }, {
    name: "compact-component-module",
    enforce: "post",
    async renderChunk(code) {
      const result = await transform(code, { minify: true, format: "esm", target: "es2022", legalComments: "eof" });
      return { code: result.code, map: null };
    },
  }],
  build: { outDir: "../sky_sailer/frontend/build", emptyOutDir: true, copyPublicDir: false, sourcemap: false, minify: false, lib: { entry: "src/index.ts", formats: ["es"], fileName: "index-[hash]" }, rollupOptions: { output: { assetFileNames: "index-[hash][extname]" } } },
});
