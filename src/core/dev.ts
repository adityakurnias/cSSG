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

// Jalankan server HTTP utama yang juga menangani upgrade ke WebSocket.
Deno.serve(
  {
    // Gunakan port 3000 agar konsisten dengan Vite
    port: 3000,
    onListen: ({ port }) =>
      console.log(`🚀 Dev server running on http://localhost:${port}`),
  },
  async (req) => {
    const { pathname } = new URL(req.url);

    // Endpoint khusus untuk koneksi WebSocket dari HMR script.
    if (pathname === "/_ws") {
      const { socket, response } = Deno.upgradeWebSocket(req);

      socket.onopen = () => {
        clients.add(socket);
        console.log(`📡 Client connected (${clients.size} total)`);
      };

      socket.onclose = () => {
        clients.delete(socket);
        console.log(`📡 Client disconnected (${clients.size} total)`);
      };

      return response;
    }

    // Untuk request file HTML, injeksikan HMR script sebelum mengirim response.
    if (pathname.endsWith(".html") || pathname === "/") {
      try {
        const filePath = join(
          config.root,
          "dist",
          pathname === "/" ? "index.html" : pathname
        );
        const file = await getFileWithCache(filePath);

        const injected = file.includes("</body>")
          ? file.replace("</body>", `${hmrScript}</body>`)
          : file + hmrScript;

        return new Response(injected, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-cache, no-store, must-revalidate",
          },
        });
      } catch {
        return new Response("404 - Page not found", { status: 404 });
      }
    }

    // Untuk request lain (CSS, JS, gambar), sajikan file statis dari direktori 'dist'.
    return serveDir(req, {
      fsRoot: "dist",
      enableCors: true,
      headers: ["cache-control: no-cache"], // Disable caching in dev mode
    });
  }
);

// Lakukan build awal saat server pertama kali dijalankan.
config = await loadConfig(Deno.cwd());
console.log("🏗️  Initial build...");
await build(config, "dev");
console.log("👀 Watching for changes...");

// Daftar path atau pola yang akan diabaikan oleh file watcher.
const ignoredPaths = [/\.git/, /dist/, /\.DS_Store/, /\.log$/, /\.tmp$/];

function shouldIgnore(path: string): boolean {
  return ignoredPaths.some((pattern) => pattern.test(path));
}

// Awasi perubahan file di dalam direktori 'src/'.
for await (const event of Deno.watchFs(["src"], { recursive: true })) {
  const validPaths = event.paths.filter((path) => !shouldIgnore(path));

  if (validPaths.length === 0) continue;
  if (event.kind === "access") continue; // Ignore file access events

  rebuild(validPaths);
}
