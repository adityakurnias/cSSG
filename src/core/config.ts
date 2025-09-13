import * as path from "@std/path";

/**
 * Konfigurasi yang telah di-resolve dan siap digunakan oleh tool.
 * Semua path di sini adalah absolut.
 */
export type ResolvedConfig = {
  root: string;
  pagesDir: string;
  layoutsDir: string;
  dataDir: string;
  assetsDir: string;
  outDir: string;
  site: Record<string, any>;
};

/**
 * Konfigurasi yang mungkin disediakan oleh pengguna di `cssg.config.ts`.
 * Semua properti bersifat opsional.
 */
export type UserConfig = Partial<Omit<ResolvedConfig, "root">>;

const defaultConfig: UserConfig = {
  pagesDir: "src/pages",
  layoutsDir: "src/layouts",
  dataDir: "src/data",
  assetsDir: "src/assets",
  outDir: "dist",
};

export async function loadConfig(root: string): Promise<ResolvedConfig> {
  const configPath = path.join(root, "cssg.config.ts");
  let userConfig: UserConfig = {};

  try {
    // Tambahkan query parameter unik untuk "cache-busting".
    // Paksa Deno untuk memuat ulang file dari disk, bukan dari cache.
    const mod = await import(
      `file://${path.toFileUrl(configPath).pathname}?v=${Date.now()}`
    );
    userConfig = (mod.default || {}) as UserConfig;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      if (error instanceof Error) {
        console.warn(`⚠️  Gagal memuat cssg.config.ts: ${error.message}`);
      } else {
        console.warn(
          `⚠️  Gagal memuat cssg.config.ts dengan error yang tidak diketahui.`
        );
      }
    }
  }

  // Gabungkan default, config pengguna, dan pastikan 'site' juga digabung dengan benar
  const mergedConfig = {
    ...defaultConfig,
    ...userConfig,
    site: { ...defaultConfig.site, ...userConfig.site },
  };

  // Resolve semua path menjadi absolut
  return {
    root,
    pagesDir: path.resolve(root, mergedConfig.pagesDir!),
    layoutsDir: path.resolve(root, mergedConfig.layoutsDir!),
    dataDir: path.resolve(root, mergedConfig.dataDir!),
    assetsDir: path.resolve(root, mergedConfig.assetsDir!),
    outDir: path.resolve(root, mergedConfig.outDir!),
    site: mergedConfig.site!,
  };
}
