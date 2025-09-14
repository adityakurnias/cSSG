// deno-lint-ignore-file no-explicit-any
import * as path from "@std/path";

/**
 * The resolved configuration, ready to be used by the tool.
 * All paths here are absolute.
 */
export type ResolvedConfig = {
  root: string;
  pagesDir: string;
  layoutsDir: string;
  dataDir: string;
  assetsDir: string;
  publicDir: string;
  outDir: string;
  site: Record<string, any>;
};

/**
 * The configuration that can be provided by the user in `cssg.config.ts`.
 * All properties are optional.
 */
export type UserConfig = Partial<Omit<ResolvedConfig, "root">>;

const defaultConfig: UserConfig = {
  pagesDir: "src/pages",
  layoutsDir: "src/layouts",
  dataDir: "src/data",
  assetsDir: "src/assets",
  publicDir: "public",
  outDir: "dist",
  site: {},
};

export async function loadConfig(root: string): Promise<ResolvedConfig> {
  const configPath = path.join(root, "cssg.config.ts");
  let userConfig: UserConfig = {};

  try {
    // Add a unique query parameter for "cache-busting".
    // This forces Deno to reload the file from disk, not from the cache.
    const mod = await import(
      `file://${path.toFileUrl(configPath).pathname}?v=${Date.now()}`
    );
    userConfig = (mod.default || {}) as UserConfig;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      if (error instanceof Error) {
        console.warn(`⚠️  Failed to load cssg.config.ts: ${error.message}`);
        console.warn(`⚠️  Make sure you're on project directory ⚠️`);
        Deno.exit(1);
      } else {
        console.warn(
          `⚠️  Failed to load cssg.config.ts with an unknown error.`
        );
      }
    }
  }

  // Merge the default config, user config, and ensure 'site' is also merged correctly.
  const mergedConfig = {
    ...defaultConfig,
    ...userConfig,
    site: { ...defaultConfig.site, ...userConfig.site },
  };

  // Resolve all paths to be absolute.
  return {
    root,
    pagesDir: path.resolve(root, mergedConfig.pagesDir!),
    layoutsDir: path.resolve(root, mergedConfig.layoutsDir!),
    dataDir: path.resolve(root, mergedConfig.dataDir!),
    assetsDir: path.resolve(root, mergedConfig.assetsDir!),
    publicDir: path.resolve(root, mergedConfig.publicDir!),
    outDir: path.resolve(root, mergedConfig.outDir!),
    site: mergedConfig.site!,
  };
}
