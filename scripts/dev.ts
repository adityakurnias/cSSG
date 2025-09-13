import { serveDir } from "@std/http/file-server";
import { join } from "@std/path";
import { build } from "./build.ts";

const clients = new Set<WebSocket>();

// Script auto-reload
const hmrScript = `
<script>
(function connect(){
  const ws=new WebSocket("ws://"+location.host+"/_ws");
  ws.onmessage=(ev)=>{ if(ev.data==="reload") location.reload(); };
  ws.onclose=()=>setTimeout(connect,1000); // auto reconnect
})();
</script>
`;

// Jalankan HTTP + WebSocket server
Deno.serve(async (req) => {
  const { pathname } = new URL(req.url);

  // WebSocket endpoint
  if (pathname === "/_ws") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    socket.onopen = () => clients.add(socket);
    socket.onclose = () => clients.delete(socket);
    return response;
  }

  // Inject script HMR ke HTML
  if (pathname.endsWith(".html") || pathname === "/") {
    const file = await Deno.readTextFile(
      join(Deno.cwd(), "dist", pathname === "/" ? "index.html" : pathname),
    );
    const injected = file.includes("</body>")
      ? file.replace("</body>", `${hmrScript}</body>`)
      : file + hmrScript;
    return new Response(injected, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // Serve file statis
  return serveDir(req, { fsRoot: "dist" });
});

// Build pertama kali
await build();

// Watch `src/` untuk rebuild otomatis
let timer: number | undefined;
for await (const event of Deno.watchFs("src")) {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    console.log("🔄 Rebuilding due to change:", event.paths);
    await build();
    for (const c of clients) c.send("reload"); // push reload ke semua client
  }, 100); // debounce 100ms
}
