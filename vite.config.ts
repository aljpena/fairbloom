import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (mode === "production" && !env.VITE_API_URL) {
    console.warn(
      "\n[FairBloom] VITE_API_URL is not set. The built app will call /api on its own domain,\n" +
        "which only works behind a reverse proxy. On Vercel/Netlify set VITE_API_URL to the\n" +
        "backend URL (e.g. https://your-api.vercel.app/api) and rebuild.\n"
    );
  }
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "http://localhost:5000",
          changeOrigin: true,
        },
      },
    },
  };
});
