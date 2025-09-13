import { parseArgs } from "@std/cli/parse-args";
import { build } from "./core/build.ts";
import { resolve } from "@std/path";
import { loadConfig } from "./core/config.ts";
import { init } from "./core/init.ts";

const args = parseArgs(Deno.args, { boolean: ["help"], alias: { h: "help" } });
const command = args._[0];

if (args.help || !command) {
  console.log(`cSSG - Simple Static Site Generator

USAGE:
  cssg <COMMAND>

COMMANDS:
  init    Initialize a new cSSG project.
  build   Build the site for production.
  dev     Start the development server.
  `);
  Deno.exit(0);
}

const userRoot = Deno.cwd();

switch (command) {
  case "init": {
    const projectDir =
      typeof args._[1] === "string" ? (args._[1] as string) : ".";
    const targetRoot = resolve(userRoot, projectDir);
    await init(targetRoot);
    break;
  }

  case "build": {
    const config = await loadConfig(userRoot);
    console.log("🚀 Memulai production build...");
    await build(config, "prod");
    console.log("✨ Build selesai.");
    break;
  }

  case "dev": {
    // Menjalankan server pengembangan kustom sebagai modul terpisah.
    // Ini adalah cara bersih untuk menjalankannya tanpa Vite.
    console.log("🔥 Starting custom dev server...");
    await import("./core/dev.ts");
    break;
  }

  default:
    console.error(`❌ Perintah tidak dikenal: ${command}`);
    Deno.exit(1);
}
