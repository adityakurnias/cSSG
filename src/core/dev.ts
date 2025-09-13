import { serveDir } from "@std/http/file-server";
import { join } from "@std/path";
import { build } from "./build.ts";
import { loadConfig } from "./config.ts";
import type { ResolvedConfig } from "./config.ts";

// Menyimpan semua koneksi WebSocket yang aktif untuk Hot Module Replacement (HMR).
const clients = new Set<WebSocket>();
// Flag untuk mencegah beberapa proses build berjalan bersamaan (race condition).
let buildInProgress = false;
let config: ResolvedConfig;

/**
 * Script yang diinjeksikan ke setiap halaman HTML di mode dev.
 * Bertugas untuk:
 * 1. Membuat koneksi WebSocket ke server dev.
 * 2. Mendengarkan pesan 'reload' dan memuat ulang halaman.
 * 3. Mencoba menyambung kembali secara otomatis jika koneksi terputus.
 */
const hmrScript = `
<script>
(function connect(){
 let retryCount = 0;
 const maxRetries = 5;
 
 function createConnection() {
   const ws = new WebSocket("ws://" + location.host + "/_ws");
   
   ws.onmessage = (ev) => {
     if (ev.data === "reload") {
       location.reload();
     }
   };
   
   ws.onopen = () => {
     retryCount = 0;
     console.log("🔗 HMR connected");
   };
   
   ws.onclose = () => {
     if (retryCount < maxRetries) {
       retryCount++;
       setTimeout(createConnection, Math.min(1000 * retryCount, 5000));
     }
   };
   
   ws.onerror = () => {
     console.log("🔌 HMR connection error");
   };
 }
 
 createConnection();
})();
</script>
`;

// Cache sederhana untuk konten file HTML agar tidak perlu membaca dari disk pada setiap request.
const fileCache = new Map<string, { content: string; mtime: number }>();

/**
 * Mengambil konten file dari cache jika memungkinkan.
 * Jika file di disk lebih baru dari yang di cache, cache akan diperbarui.
 * Ini mengoptimalkan penyajian file HTML yang sering diakses.
 * @param {string} filePath Path ke file.
 * @returns {Promise<string>} Konten file.
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
    // File tidak ditemukan atau error lain
    fileCache.delete(filePath);
    throw new Error(`File not found: ${filePath}`);
  }
}

/**
 * Fungsi debounced untuk men-trigger proses build ulang.
 * Ini mencegah build berjalan berulang kali saat banyak file disimpan dalam waktu singkat.
 * @param {string[]} changedPaths Daftar path file yang berubah.
 */
let rebuildTimer: number | undefined;
const DEBOUNCE_MS = 200; // Waktu tunggu sebelum rebuild

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

      await build(config, "dev");

      const endTime = performance.now();
      console.log(
        `✅ Rebuild completed in ${(endTime - startTime).toFixed(2)}ms`
      );

      // Kirim sinyal 'reload' ke semua klien yang terhubung.
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send("reload");
        }
      }
    } catch (error) {
      console.error("❌ Build error:", error);
    } finally {
      buildInProgress = false;
    }
  }, DEBOUNCE_MS);
}

/**
 * Memulai server pengembangan, melakukan build awal, dan mengawasi perubahan file.
 */
export async function startDevServer() {
  // Lakukan build awal saat server pertama kali dijalankan.
  config = await loadConfig(Deno.cwd());
  console.log("🏗️  Initial build...");
  await build(config, "dev");
  console.log("👀 Watching for changes...");

  // Jalankan server HTTP utama yang juga menangani upgrade ke WebSocket.
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
        socket.onopen = () => clients.add(socket);
        socket.onclose = () => clients.delete(socket);
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

  // Awasi perubahan file di dalam direktori 'src/'.
  const ignoredPaths = [/\.git/, /dist/, /\.DS_Store/, /\.log$/, /\.tmp$/];
  function shouldIgnore(path: string): boolean {
    return ignoredPaths.some((pattern) => pattern.test(path));
  }
  for await (const event of Deno.watchFs(config.pagesDir, {
    recursive: true,
  })) {
    const validPaths = event.paths.filter((path) => !shouldIgnore(path));
    if (validPaths.length === 0 || event.kind === "access") continue;
    rebuild(validPaths);
  }
}
