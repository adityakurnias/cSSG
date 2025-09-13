import { serveDir } from "@std/http/file-server";
import { join } from "@std/path";
import { build } from "./build.ts";


const clients = new Set<WebSocket>();

// server HTTP + WS
Deno.serve(async (req) => {
  const { pathname } = new URL(req.url);

  if (pathname === "/_ws") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    socket.onopen = () => clients.add(socket);
    socket.onclose = () => clients.delete(socket);
    return response;
  }

  // Inject HMR ke setiap HTML di dist
  if (pathname.endsWith(".html") || pathname === "/") {
    const file = await Deno.readTextFile(
      join(Deno.cwd(), "dist", pathname === "/" ? "index.html" : pathname)
    );
    const injected = file.replace(
      "</body>",
      `<script>
        const ws=new WebSocket("ws://localhost:8000/_ws");
        ws.onmessage=(ev)=>{if(ev.data==="reload") location.reload();}
      </script></body>`
    );
    return new Response(injected, { headers: { "content-type": "text/html" } });
  }

  return serveDir(req, { fsRoot: "dist" });
});

// Menjalankan build untuk pertama kali
await build();

// Melakukan watch ke file di src
for await (const event of Deno.watchFs("src")) {
  console.log("🔄 Rebuilding due to change:", event.paths);
  await build();
  for (const c of clients) c.send("reload");
}
