import { Eta } from "@eta-dev/eta";
import { emptyDir, ensureDir, exists, walk } from "@std/fs";
import { join, relative } from "@std/path";
import * as esbuild from "esbuild";
import type { ResolvedConfig } from "./config.ts";
import { extract } from "@std/front-matter/yaml";

/**
 * Fungsi build utama untuk SSG.
 * @param mode Menentukan mode build: 'dev' untuk pengembangan, 'prod' untuk produksi.
 */
export async function build(config: ResolvedConfig, mode: "dev" | "prod") {
  const isProd = mode === "prod";
  const basePath = Deno.env.get("BASE_PATH") || "";
  console.log(`\n--- 🚀 Memulai build mode '${mode}' ---`);

  const { outDir, assetsDir, pagesDir, dataDir, layoutsDir } = config;
  // Eta's views root should be the project root to resolve layoutsDir correctly
  const etaViewsRoot = config.root;

  try {
    // Hanya bersihkan direktori 'dist' pada build pertama atau build produksi.
    // Ini mencegah penghapusan yang tidak perlu selama hot-reload.
    if (isProd) {
      await emptyDir(outDir);
    }
    await ensureDir(outDir);

    const eta = new Eta({ views: etaViewsRoot, useWith: true });

    // --- Pemrosesan Aset (CSS & JS) ---
    console.log("📦 Memproses aset...");

    const assetPromises = [];

    // 1. Konfigurasi untuk bundel dan minifikasi CSS
    const cssEntryPoint = join(assetsDir, "css", "style.css");
    if (await exists(cssEntryPoint, { isFile: true })) {
      assetPromises.push(
        esbuild.build({
          entryPoints: [cssEntryPoint],
          outfile: join(outDir, "assets", "css", "style.css"),
          bundle: true,
          minify: isProd,
          sourcemap: !isProd,
        })
      );
    }

    // 2. Konfigurasi untuk file JavaScript
    const jsAssetsDir = join(assetsDir, "js");
    if (await exists(jsAssetsDir, { isDirectory: true })) {
      for await (const entry of walk(jsAssetsDir, { exts: [".js"] })) {
        const jsRelPath = relative(assetsDir, entry.path);
        assetPromises.push(
          esbuild.build({
            entryPoints: [entry.path],
            outfile: join(outDir, "assets", jsRelPath),
            minify: isProd,
            bundle: isProd,
            sourcemap: !isProd,
          })
        );
      }
    }

    await Promise.all(assetPromises);
    console.log("✅ Aset berhasil diproses.");

    // --- Memuat Data Dinamis ---
    // Secara otomatis memuat semua file .json dari direktori data.
    // Kunci objek akan menjadi nama file.
    console.log("📚 Memuat data...");
    const siteData: Record<string, any> = {};
    if (await exists(dataDir, { isDirectory: true })) {
      for await (const entry of walk(dataDir, { exts: [".json"] })) {
        const key = relative(dataDir, entry.path).replace(".json", "");
        siteData[key] = JSON.parse(await Deno.readTextFile(entry.path));
      }
    }

    const loadedDataKeys = Object.keys(siteData);
    if (loadedDataKeys.length > 0) {
      console.log(`✅ Data berhasil dimuat: ${loadedDataKeys.join(", ")}`);
    } else {
      console.log("🤷 Tidak ada data yang dimuat.");
    }
    // --- Merender Halaman Eta ke HTML ---
    console.log("📄 Merender halaman...");
    for await (const entry of walk(pagesDir, { includeDirs: false })) {
      if (entry.isFile && entry.name.endsWith(".eta")) {
        try {
          const fileContent = await Deno.readTextFile(entry.path);
          const { attrs, body: pageTemplate } = extract(fileContent);

          const pageAttrs =
            typeof attrs === "object" && attrs !== null ? attrs : {};

          const ctx: Record<string, any> = {
            site: config.site, // from cssg.config.ts
            ...siteData,
            ...pageAttrs, // from page frontmatter
            basePath: basePath, // Inject base path into context
          };

          const pageBody = eta.renderString(pageTemplate, ctx);

          let scripts = "";
          if (ctx.script && typeof ctx.script === "string") {
            scripts = `<script src="${basePath}/assets/js/${ctx.script}" type="module"></script>`;
          }

          // Determine layout, fallback to 'main.eta'
          const layoutFile =
            typeof ctx.layout === "string" ? ctx.layout : "main.eta";
          // Create a path relative to the `views` root
          const layoutPath = relative(
            etaViewsRoot,
            join(layoutsDir, layoutFile)
          );

          const html = eta.render(layoutPath, {
            ...ctx,
            body: pageBody,
            scripts,
          })!;

          const outPath = join(
            outDir,
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
    // Hanya hentikan esbuild saat build produksi.
    // Di mode dev, service harus tetap berjalan untuk rebuild.
    if (isProd) {
      esbuild.stop();
    }
  }
}
