import { parseArgs } from "@std/cli/parse-args";
import { build } from "./core/build.ts";
import { resolve } from "@std/path";
import { loadConfig } from "./core/config.ts";
import { createProject, listTemplates } from "./core/create.ts";

// Parse command-line arguments using Deno's standard library.
const args = parseArgs(Deno.args, {
  boolean: ["help", "force", "remote"],
  string: ["template"],
  alias: {
    h: "help",
    f: "force",
  },
});

// The main command is the first positional argument (e.g., 'create', 'build').
const command = args._[0];

// If the --help flag is used or no command is provided, display the help message and exit.
if (args.help || !command) {
  console.log(`cSSG - Simple Static Site Generator

USAGE:
  cssg <COMMAND>

COMMANDS:
  create <name>   Create a new cSSG project (recommended)
  build           Build the site for production
  dev             Start the development server
  list            List all available template

CREATE OPTIONS:
  -f, --force      Overwrite existing directory
  -t, --template   Use a remote template from the official repository (default: basic)

EXAMPLES:
  cssg create my-blog
  cssg create my-blog -t counter --remote
  cssg dev         # start dev server
  cssg build       # build for production
  `);
  Deno.exit(0);
}

// Get the current working directory of the user. This is the root of the project.
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
      // Call the core function to create the project structure and files.
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
    // Load the project configuration from cssg.config.ts.
    const config = await loadConfig(userRoot);
    console.log("🚀 Starting production build...");
    // Trigger the production build process.
    await build(config, "prod");
    console.log("✨ Build finished.");
    break;
  }

  case "dev": {
    // Dynamically import the dev server to avoid loading it for other commands.
    const { startDevServer } = await import("./core/dev.ts");
    // Start the development server, which includes file watching and HMR.
    await startDevServer();
    break;
  }

  case "list": {
    await listTemplates();
    break;
  }

  default:
    // Handle any commands that are not recognized.
    console.error(`❌ Unknown command: ${command}`);
    console.log("Run 'cssg --help' for available commands");
    Deno.exit(1);
}
