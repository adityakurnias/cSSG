// deno-lint-ignore-file no-explicit-any
import { Eta } from "@eta-dev/eta";
import { copy, emptyDir, ensureDir, exists, walk } from "@std/fs";
import { join, relative } from "@std/path";
import * as esbuild from "esbuild";
import type { ResolvedConfig } from "./config.ts";
import { extract } from "@std/front-matter/yaml";

/**
 * The main build function for the SSG.
 * @param mode Specifies the build mode: 'dev' for development, 'prod' for production.
 */
export async function build(config: ResolvedConfig, mode: "dev" | "prod") {
  const isProd = mode === "prod";
  const basePath = Deno.env.get("BASE_PATH") || "";
  console.log(`\n--- 🚀 Starting build in '${mode}' mode ---`);

  const { outDir, assetsDir, pagesDir, dataDir, layoutsDir, publicDir } =
    config;
  const etaViewsRoot = config.root;

  try {
    // Only clean the 'dist' directory on the first build or in production.
    // This prevents unnecessary deletions during hot-reloading in dev mode.
    if (isProd) {
      await emptyDir(outDir);
    }
    await ensureDir(outDir);

    const eta = new Eta({ views: etaViewsRoot, useWith: true });

    // --- Asset Processing (CSS & JS) ---
    console.log("📦 Processing assets...");

    const assetPromises = [];

    // 1. Configuration for bundling and minifying CSS
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

    // 2. Configuration for JavaScript files
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
    console.log("✅ Assets processed successfully.");

    // --- Copying Public Directory ---
    console.log("📂 Copying public directory...");
    if (await exists(publicDir, { isDirectory: true })) {
      await copy(publicDir, outDir, { overwrite: true });
      console.log("✅ Public directory copied successfully.");
    } else {
      console.log("🤷 No public directory found, skipping.");
    }

    // --- Loading Dynamic Data ---
    // Automatically load all .json files from the data directory.
    // The object key will be the filename.
    console.log("📚 Loading data...");
    const siteData: Record<string, any> = {};
    if (await exists(dataDir, { isDirectory: true })) {
      for await (const entry of walk(dataDir, { exts: [".json"] })) {
        const key = relative(dataDir, entry.path).replace(".json", "");
        siteData[key] = JSON.parse(await Deno.readTextFile(entry.path));
      }
    }

    const loadedDataKeys = Object.keys(siteData);
    if (loadedDataKeys.length > 0) {
      console.log(`✅ Data loaded successfully: ${loadedDataKeys.join(", ")}`);
    } else {
      console.log("🤷 No data files were loaded.");
    }
    // --- Rendering Eta Pages to HTML ---
    console.log("📄 Rendering pages...");
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
          console.error(`❌ Error rendering ${entry.path}:`, err);
        }
      }
    }
    console.log("✅ Pages rendered successfully.");

    console.log(`\n--- ✨ Build in '${mode}' mode finished! ---`);
  } finally {
    if (isProd) {
      esbuild.stop();
    }
  }
}
