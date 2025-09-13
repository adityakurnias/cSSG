import { Eta } from "@eta-dev/eta";
import { ensureDir, emptyDir, walk } from "@std/fs";
import { join, relative } from "@std/path";
import * as esbuild from "esbuild";
import { config } from "../site.config.ts";

/**
 * Fungsi build utama untuk SSG.
 * @param mode Menentukan mode build: 'dev' untuk pengembangan, 'prod' untuk produksi.
 */
export async function build(mode: "dev" | "prod" = "prod") {
  const isProd = mode === "prod";
  // Untuk GitHub Pages, aset memerlukan base path (nama repo).
  // Di lokal, ini akan menjadi string kosong.
  const basePath = Deno.env.get("BASE_PATH") || "";
  console.log(`\n--- 🚀 Memulai build mode '${mode}' ---`);

  const srcDir = join(Deno.cwd(), "src");
  const distDir = join(Deno.cwd(), "dist");
  const assetsDir = join(srcDir, "assets");
  const pagesDir = join(srcDir, "pages");

  try {
    // Hanya bersihkan direktori 'dist' pada build pertama atau build produksi.
    // Ini mencegah penghapusan yang tidak perlu selama hot-reload.
    if (isProd) {
      await emptyDir(distDir);
    }
    await ensureDir(distDir);

    const eta = new Eta({ views: srcDir });

    // --- Pemrosesan Aset (CSS & JS) ---
    console.log("📦 Memproses aset...");

    const assetPromises = [];

    // 1. Konfigurasi untuk bundel dan minifikasi CSS
    assetPromises.push(
      esbuild.build({
        entryPoints: [join(assetsDir, "css", "style.css")],
        outfile: join(distDir, "assets", "css", "style.css"),
        bundle: true,
        minify: isProd,
        sourcemap: !isProd,
      })
    );

    // 2. Konfigurasi untuk file JavaScript
    const jsAssetsDir = join(assetsDir, "js");
    for await (const entry of walk(jsAssetsDir, { exts: [".js"] })) {
      const jsRelPath = relative(assetsDir, entry.path);
      assetPromises.push(
        esbuild.build({
          entryPoints: [entry.path],
          outfile: join(distDir, "assets", jsRelPath),
          minify: isProd,
          bundle: isProd,
          sourcemap: !isProd,
        })
      );
    }

    await Promise.all(assetPromises);
    console.log("✅ Aset berhasil diproses.");

    // --- Memuat Data Dinamis ---
    // Secara otomatis memuat semua file .json dari direktori data.
    // Kunci objek akan menjadi nama file.
    console.log("📚 Memuat data...");
    const siteData: Record<string, any> = {};
    const dataDir = join(srcDir, "data");
    for await (const entry of walk(dataDir, { exts: [".json"] })) {
      const key = relative(dataDir, entry.path).replace(".json", "");
      siteData[key] = JSON.parse(await Deno.readTextFile(entry.path));
    }
    console.log(`✅ Data berhasil dimuat: ${Object.keys(siteData).join(", ")}`);

    // --- Merender Halaman Eta ke HTML ---
    console.log("📄 Merender halaman...");
    for await (const entry of walk(pagesDir, { includeDirs: false })) {
      if (entry.isFile && entry.name.endsWith(".eta")) {
        try {
          const pageRel = relative(srcDir, entry.path).replace(/\\/g, "/");
          const ctx: Record<string, any> = {
            ...config.site,
            ...siteData,
            basePath: basePath, // Suntikkan base path ke dalam konteks
            script: undefined,
          };

          const body = eta.render(pageRel, ctx)!;

          let scripts = "";
          if (ctx.script) {
            scripts = `<script src="${basePath}/assets/js/${ctx.script}" type="module"></script>`;
          }

          const html = eta.render("layouts/main.eta", {
            ...ctx,
            body,
            scripts,
          })!;

          const outPath = join(
            distDir,
            relative(pagesDir, entry.path).replace(".eta", ".html")
          );

          await ensureDir(join(outPath, ".."));
          await Deno.writeTextFile(outPath, html);
        } catch (err) {
          console.error(`❌ Error render ${entry.path}:`, err);
        }
      }
    }
    console.log("✅ Halaman berhasil dirender.");

    console.log(`\n--- ✨ Build mode '${mode}' selesai! ---`);
  } finally {
    // Hentikan proses esbuild agar skrip bisa keluar dengan bersih.
    esbuild.stop();
  }
}

if (import.meta.main) {
  const mode = Deno.args.includes("dev") ? "dev" : "prod";
  await build(mode);
}
