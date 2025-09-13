import { parseArgs } from "@std/cli/parse-args";
import { build } from "./core/build.ts";
import { resolve } from "@std/path";
import { loadConfig } from "./core/config.ts";
import { createProject } from "./core/create.ts";

const args = parseArgs(Deno.args, {
  boolean: ["help", "force"],
  string: ["template"],
  alias: {
    h: "help",
    f: "force",
    t: "template",
  },
});

const command = args._[0];

if (args.help || !command) {
  console.log(`cSSG - Simple Static Site Generator

USAGE:
  cssg <COMMAND>

COMMANDS:
  create <name>   Create a new cSSG project (recommended)
  build           Build the site for production
  dev             Start the development server

CREATE OPTIONS:
  -f, --force      Overwrite existing directory
  -t, --template   Template to use (default: basic)

EXAMPLES:
  cssg create my-blog
  cssg dev         # start dev server
  cssg build       # build for production
  `);
  Deno.exit(0);
}

const userRoot = Deno.cwd();

switch (command) {
  case "create": {
    const projectName = args._[1] as string;
    if (!projectName) {
      console.error("❌ Project name is required for create command");
      console.log("Usage: cssg create <project-name>");
      Deno.exit(1);
    }

    const targetDir = resolve(userRoot, projectName);
    try {
      await createProject({
        projectName,
        targetDir,
        template: args.template || "basic",
        force: args.force || false,
      });

      console.log(`\n🎉 Success! Created ${projectName}`);
      console.log(`\nNext steps:`);
      console.log(`  cd ${projectName}`);
      console.log(`  cssg dev  # start development server`);
    } catch (error) {
      console.error(`❌ Error: ${error}`);
      Deno.exit(1);
    }
    break;
  }

  case "build": {
    const config = await loadConfig(userRoot);
    console.log("🚀 Starting production build...");
    await build(config, "prod");
    console.log("✨ Build finished.");
    break;
  }

  case "dev": {
    const { startDevServer } = await import("./core/dev.ts");
    await startDevServer();
    break;
  }

  default:
    console.error(`❌ Unknown command: ${command}`);
    console.log("Run 'cssg --help' for available commands");
    Deno.exit(1);
}
