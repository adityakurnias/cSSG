import { parseArgs } from "@std/cli/parse-args";
import { build } from "./core/build.ts";
import { resolve } from "@std/path";
import { loadConfig } from "./core/config.ts";
import { createProject } from "./core/create.ts";
import { listTemplates } from "./helpers/listTemplate.ts";
import { HELP_TEXT } from "./constants/help.ts";
import meta from "../deno.json" with { type: "json" };

// Parse command-line arguments using Deno's standard library.
const args = parseArgs(Deno.args, {
  boolean: ["help", "force", "version"],
  string: ["template"],
  alias: {
    h: "help",
    f: "force",
    t: "template",
    v: "version"
  },
});

const VERSION = meta.version;

// The main command is the first positional argument (e.g., 'create', 'build').
const command = args._[0];

if (args.version || command === "version") {
  console.log(`cSSG v${VERSION}`);
  Deno.exit(0);
}

// If the --help flag is used or no command is provided, display the help message and exit.
if (args.help || !command) {
  console.log(HELP_TEXT);
  Deno.exit(0);
}

// Get the current working directory of the user.
const userRoot = Deno.cwd();

// Handle the different commands that the CLI can execute.
switch (command) {
  case "create": {
    const projectName = args._[1] as string;
    // Ensure a project name is provided for the 'create' command.
    if (!projectName) {
      console.error("❌ Project name is required for create command");
      console.log("Usage: cssg create <project-name>");
      Deno.exit(1);
    }

    // Resolve the absolute path for the new project directory.
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

  case "list": {
    await listTemplates();
    break;
  }

  default:
    console.error(`❌ Unknown command: ${command}`);
    console.log("Run 'cssg --help' for available commands");
    Deno.exit(1);
}
