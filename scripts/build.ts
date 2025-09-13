import { Eta } from "@eta-dev/eta";
import { ensureDir, emptyDir, walk } from "@std/fs";
import { join, relative } from "@std/path";
import { config } from "../site.config.ts";

export async function build() {
  const srcDir = join(Deno.cwd(), "src");
  const distDir = join(Deno.cwd(), "dist");
  const pagesDir = join(srcDir, "pages");

  const eta = new Eta({ views: srcDir });

  // Memastikan dist bersih
  await emptyDir(distDir);
  await ensureDir(distDir);

  // Loop melalui semua file di direktori pages
  for await (const entry of walk(pagesDir, { includeDirs: false })) {
    if (entry.isFile && entry.name.endsWith(".eta")) {
      try {
        // Path relatif halaman
        const pageRel = relative(srcDir, entry.path).replace(/\\/g, "/");

        // Render halaman spesifik dengan data dari site.config.ts
        const body = eta.render(pageRel, config.site)!;

        // Render layout utama dengan body dari halaman
        // TODO: Bisa dibuat dinamis (mis. baca dari front-matter)
        const html = eta.render("templates/layout.eta", {
          ...config.site,
          body,
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
