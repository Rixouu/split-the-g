import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/postcss";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Expose all .env* vars (including non-VITE_ secrets) to the Node process for SSR actions.
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    resolve: {
      /** Avoid two React copies (hooks dispatcher null → "Cannot read properties of null (reading 'useState')"). */
      dedupe: ["react", "react-dom"],
    },
    ssr: {
      external: ["sharp"],
    },
    css: {
      postcss: {
        plugins: [tailwindcss],
      },
    },
    plugins: [reactRouter(), tsconfigPaths()],
  };
});
