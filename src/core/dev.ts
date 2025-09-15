import { serveDir } from "@std/http/file-server";
import { join } from "@std/path";
import { build } from "./build.ts";
import { loadConfig } from "./config.ts";
import type { ResolvedConfig } from "./config.ts";
import { hmrScript } from "../constants/hmr.ts";

// Stores all active WebSocket connections for Hot Module Replacement (HMR).
const clients = new Set<WebSocket>();
// Flag to prevent multiple build processes from running concurrently (race condition).
let buildInProgress = false;
let config: ResolvedConfig;

// A simple cache for HTML file content to avoid reading from disk on every request.
const fileCache = new Map<string, { content: string; mtime: number }>();

/**
 * Retrieves file content from the cache if possible.
 * If the file on disk is newer than the cached version, the cache is updated.
 * This optimizes serving frequently accessed HTML files.
 * @param {string} filePath The path to the file.
 * @returns {Promise<string>} The file content.
 */
async function getFileWithCache(filePath: string): Promise<string> {
  try {
    const stat = await Deno.stat(filePath);
    const cached = fileCache.get(filePath);
    const currentMtime = stat.mtime?.getTime() ?? 0;

    if (cached && cached.mtime >= currentMtime) {
      return cached.content;
    }

    const content = await Deno.readTextFile(filePath);
    fileCache.set(filePath, {
      content,
      mtime: currentMtime,
    });

    return content;
  } catch {
    // File not found or other error
    fileCache.delete(filePath);
    throw new Error(`File not found: ${filePath}`);
  }
}

/**
 * A debounced function to trigger the rebuild process.
 * This prevents the build from running repeatedly when many files are saved in a short period.
 * @param {string[]} changedPaths A list of paths for the files that have changed.
 */
let rebuildTimer: number | undefined;
const DEBOUNCE_MS = 200; // Wait time before a rebuild

function rebuild(changedPaths: string[]) {
  if (buildInProgress) {
    console.log("⏳ Build in progress, skipping...");
    return;
  }

  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(async () => {
    buildInProgress = true;

    try {
      console.log("🔄 Rebuilding due to changes:", changedPaths);
      const startTime = performance.now();

      // Check if the configuration file has changed.
      const configPath = join(config.root, "cssg.config.ts");
      if (changedPaths.some((p) => p === configPath)) {
        console.log("⚙️ Config file changed, reloading...");
        config = await loadConfig(config.root);
      }

      // Determine if only CSS files were changed.
      // This is a simple check; it could be expanded to include preprocessor files (e.g., .scss).
      const isCssOnlyChange = changedPaths.every((p) => p.endsWith(".css"));

      await build(config, "dev");

      const endTime = performance.now();
      console.log(
        `✅ Rebuild completed in ${(endTime - startTime).toFixed(2)}ms`
      );

      // Send a granular CSS update or a full reload signal.
      if (isCssOnlyChange) {
        const cssUpdatePayload = JSON.stringify({
          type: "css-update",
          path: "/assets/css/style.css", // Assumes a single CSS output file
        });
        clients.forEach((client) => client.send(cssUpdatePayload));
      } else {
        clients.forEach((client) => client.send("reload"));
      }
    } catch (error) {
      console.error("❌ Build error:", error);
    } finally {
      buildInProgress = false;
    }
  }, DEBOUNCE_MS);
}

/**
 * Starts the development server, performs an initial build, and watches for file changes.
 */
export async function startDevServer() {
  // Perform an initial build when the server first starts.
  config = await loadConfig(Deno.cwd());
  console.log("🏗️  Initial build...");
  await build(config, "dev");
  console.log("👀 Watching for changes...");

  // Run the main HTTP server, which also handles WebSocket upgrades.
  Deno.serve(
    {
      port: 3000,
      onListen: ({ port }) =>
        console.log(`🚀 Dev server running on http://localhost:${port}`),
    },
    async (req) => {
      const { pathname } = new URL(req.url);

      if (pathname === "/_ws") {
        const { socket, response } = Deno.upgradeWebSocket(req);
        socket.onopen = () => {
          clients.add(socket);
        };
        socket.onclose = () => {
          clients.delete(socket);
        };
        socket.onerror = (e) => console.error("WebSocket error:", e);
        return response;
      }

      if (pathname.endsWith(".html") || pathname === "/") {
        try {
          const filePath = join(
            config.outDir,
            pathname === "/" ? "index.html" : pathname
          );
          const file = await getFileWithCache(filePath);
          const injected = file.replace("</body>", `${hmrScript}</body>`);
          return new Response(injected, {
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "no-cache",
            },
          });
        } catch {
          return new Response("404 - Page not found", { status: 404 });
        }
      }

      return serveDir(req, {
        fsRoot: config.outDir,
        enableCors: true,
        headers: ["cache-control: no-cache"],
      });
    }
  );

  // Watch for file changes within the project directory.
  const ignoredPaths = [/\.git/, /dist/, /\.DS_Store/, /\.log$/, /\.tmp$/];
  function shouldIgnore(path: string): boolean {
    return ignoredPaths.some((pattern) => pattern.test(path));
  }
  for await (const event of Deno.watchFs(config.root, {
    recursive: true,
  })) {
    const validPaths = event.paths.filter((path) => !shouldIgnore(path));
    if (validPaths.length === 0 || event.kind === "access") continue;
    rebuild(validPaths);
  }
}
