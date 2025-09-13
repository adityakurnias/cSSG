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

        const ctx: Record<string, any> = { ...config.site, script: undefined };

        // Render halaman spesifik
        const body = eta.render(pageRel, ctx)!;

        // Cari file .js yang didefinisikan di halaman
        let scripts = "";
        if (ctx.script) {
          const scriptPath = join(srcDir, "assets/js", ctx.script);
          try {
            const scriptContent = await Deno.readTextFile(scriptPath);
            scripts = `<script type="module">${scriptContent}</script>`;
          } catch (error) {
            if (error instanceof Deno.errors.NotFound) {
              console.warn(`⚠️ Script not found for ${pageRel}: ${scriptPath}`);
            } else {
              throw error;
            }
          }
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
