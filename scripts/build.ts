import { Eta } from "@eta-dev/eta";
import { ensureDir, emptyDir, walk } from "@std/fs";
import { join, relative } from "@std/path";
import * as esbuild from "esbuild";
import { config } from "../site.config.ts";

export async function build(mode: "dev" | "prod" = "prod") {
  const srcDir = join(Deno.cwd(), "src");
  const distDir = join(Deno.cwd(), "dist");
  const assetsDir = join(srcDir, "assets");
  const pagesDir = join(srcDir, "pages");

  try {
    const eta = new Eta({ views: srcDir });

    // Memastikan dist bersih
    await emptyDir(distDir);
    await ensureDir(distDir);

    console.log("📦 Processing assets...");
    // 1. Bundel dan minifikasi CSS
    let ctx: esbuild.BuildContext | null = null;

    if (mode === "dev") {
      ctx = await esbuild.context({
        entryPoints: [join(assetsDir, "css/style.css")],
        outfile: join(distDir, "assets/css/style.css"),
        bundle: true,
        sourcemap: true,
      });
      await ctx.watch(); // watch internal
    }

    console.log("   - CSS bundled and minified.");

    // 2. Minifikasi file JavaScript
    const jsAssetsDir = join(assetsDir, "js");
    for await (const entry of walk(jsAssetsDir, { exts: [".js"] })) {
      const jsRelPath = relative(assetsDir, entry.path);
      await esbuild.build({
        entryPoints: [entry.path],
        outfile: join(distDir, "assets", jsRelPath),
        minify: mode === "prod",
        bundle: true,
        sourcemap: mode === "dev",
      });
    }
    console.log("   - JavaScript minified.");
    console.log("📂 Assets processed.");

    // Loop melalui semua file di direktori pages
    for await (const entry of walk(pagesDir, { includeDirs: false })) {
      if (entry.isFile && entry.name.endsWith(".eta")) {
        try {
          // Path relatif halaman
          const pageRel = relative(srcDir, entry.path).replace(/\\/g, "/");

          const ctx: Record<string, any> = {
            ...config.site,
            script: undefined,
          };

          // Render halaman spesifik
          const body = eta.render(pageRel, ctx)!;

          // Buat tag <script> jika didefinisikan di halaman
          let scripts = "";
          if (ctx.script) {
            scripts = `<script src="/assets/js/${ctx.script}" type="module"></script>`;
          }

          // Render layout utama dengan body dan script dari halaman
          const html = eta.render("layouts/main.eta", {
            ...ctx,
            body,
            scripts,
          })!;
          // Tentukan path output
          const outPath = join(
            distDir,
            relative(pagesDir, entry.path).replace(".eta", ".html")
          );

          // Memastikan ada direktori tujuan
          await ensureDir(join(outPath, ".."));

          // Ouput
          await Deno.writeTextFile(outPath, html);

          console.log(
            `✅ ${relative(Deno.cwd(), entry.path)} → ${relative(
              Deno.cwd(),
              outPath
            )}`
          );
        } catch (err) {
          console.error(`❌ Error render ${entry.path}:`, err);
        }
      }
    }

    console.log("✨ Build selesai!");
  } finally {
    esbuild.stop();
  }
}
