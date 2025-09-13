import { Eta } from "@eta-dev/eta";
import { ensureDir, emptyDir, walk, copy } from "@std/fs";
import { join, relative } from "@std/path";
import { config } from "../site.config.ts";

export async function build() {
  const srcDir = join(Deno.cwd(), "src");
  const distDir = join(Deno.cwd(), "dist");
  const assetsDir = join(srcDir, "assets");
  const pagesDir = join(srcDir, "pages");

  const eta = new Eta({ views: srcDir });

  // Memastikan dist bersih
  await emptyDir(distDir);
  await ensureDir(distDir);

  // Salin semua aset statis (CSS, JS, gambar, dll.)
  await copy(assetsDir, join(distDir, "assets"), { overwrite: true });

  // Loop melalui semua file di direktori pages
  for await (const entry of walk(pagesDir, { includeDirs: false })) {
    if (entry.isFile && entry.name.endsWith(".eta")) {
      try {
        // Path relatif halaman
        const pageRel = relative(srcDir, entry.path).replace(/\\/g, "/");

        const ctx: Record<string, any> = { ...config.site, script: undefined };

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

        // Output hasil
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
}
