import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env vars (including REACT_APP_ prefix)
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "::",
      port: 8080,
      allowedHosts: true,
      hmr: {
        overlay: false,
      },
    },
    define: {
      // Expose REACT_APP_BACKEND_URL as VITE_API_URL at build time
      "import.meta.env.VITE_API_URL": JSON.stringify(
        env.REACT_APP_BACKEND_URL || env.VITE_API_URL || ""
      ),
    },
    optimizeDeps: {
      include: ["react-is", "recharts"],
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
  };
});
