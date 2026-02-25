import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  main: {
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
      },
    },
    build: {
      lib: {
        entry: resolve("src/main/main.ts"),
      },
    },
  },
  preload: {
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
      },
    },
    build: {
      rollupOptions: {
        input: {
          preload: resolve("src/preload/preload.ts"),
        },
      },
    },
  },
  renderer: {
    root: resolve("src/renderer"),
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/renderer/index.html"),
        },
      },
    },
    plugins: [react()],
  },
});
