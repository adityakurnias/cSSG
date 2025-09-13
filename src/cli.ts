import { parseArgs } from "@std/cli/parse-args";
import { createServer } from "vite";
import { build } from "./core/build.ts";
import { cSSGPlugin } from "../scripts/vite-plugin-cssg.ts";
import { resolve } from "@std/path";

const args = parseArgs(Deno.args, { boolean: ["help"], alias: { h: "help" } });
const command = args._[0];

if (args.help || !command) {
  console.log(`cSSG - Simple Static Site Generator

USAGE:
  cssg <COMMAND>

COMMANDS:
  build   Build the site for production.
  dev     Start the development server with Vite.
  `);
  Deno.exit(0);
}

const userRoot = Deno.cwd();
const distDir = resolve(userRoot, "dist");

switch (command) {
  case "build":
    console.log("🚀 Memulai production build...");
    await build({ mode: "prod", cwd: userRoot });
    console.log("✨ Build selesai.");
    break;

  case "dev":
    const server = await createServer({
      root: distDir, // Vite akan menyajikan file dari 'dist'
      server: { port: 3000 },
      plugins: [cSSGPlugin({ cwd: userRoot })],
      // Kosongkan 'dist' agar Vite tidak bingung dengan file lama saat start
      clearScreen: false,
    });
    await server.listen();
    server.printUrls();
    break;

  default:
    console.error(`❌ Perintah tidak dikenal: ${command}`);
    Deno.exit(1);
}
