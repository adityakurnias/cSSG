import { serveDir } from "@std/http/file-server";

Deno.serve((req) => {
  return serveDir(req, {
    fsRoot: ".d/dist",
    urlRoot: "",
    showDirListing: true,
    enableCors: true,
  });
});
