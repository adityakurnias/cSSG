import { ensureDir } from "@std/fs/ensure-dir";
import { exists } from "@std/fs/exists";
import * as path from "@std/path";

const cssgConfigContent = `import type { UserConfig } from "@adityakurnias/cssg";

const config: UserConfig = {
  site: {
    title: "My Awesome Site",
    description: "A new site generated with cSSG!",
  },
};

export default config;
`;

const mainLayoutContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%~ it.site.title %></title>
  <meta name="description" content="<%~ it.site.description %>">
  <%~ it.head ?? '' %>
</head>
<body>
  <header>
    <h1>Welcome to <%~ it.site.title %></h1>
    <nav>
      <a href="<%= it.basePath ?? '' %>/index.html">Home</a>
    </nav>
  </header>
  <main>
    <%~ it.body %>
  </main>
  <footer>
    <p>Powered by cSSG</p>
  </footer>
  <%~ it.scripts ?? '' %>
</body>
</html>
`;

const indexPageContent = `---
title: "Home Page"
---
<p>This is the home page. Welcome to your new cSSG site!</p>
<p>Edit this file in <code>src/pages/index.eta</code>.</p>
`;

const gitignoreContent = `# cSSG
dist

# Deno
deno.lock

# Node
node_modules

# IDE
.vscode/
`;

async function writeFile(filePath: string, content: string) {
  if (await exists(filePath)) {
    console.log(
      `🟡 File already exists, skipping: ${path.relative(Deno.cwd(), filePath)}`
    );
  } else {
    await Deno.writeTextFile(filePath, content);
    console.log(`✅ Created file: ${path.relative(Deno.cwd(), filePath)}`);
  }
}

export async function init(root: string) {
  console.log(`\n🚀 Initializing new cSSG project in ${root}...\n`);

  const dirs = ["src", "src/pages", "src/layouts", "src/data", "src/assets"];
  for (const dir of dirs) {
    const dirPath = path.join(root, dir);
    await ensureDir(dirPath);
    console.log(`✅ Created directory: ${path.relative(Deno.cwd(), dirPath)}`);
  }

  await writeFile(path.join(root, "cssg.config.ts"), cssgConfigContent);
  await writeFile(path.join(root, ".gitignore"), gitignoreContent);
  await writeFile(path.join(root, "src/layouts/main.eta"), mainLayoutContent);
  await writeFile(path.join(root, "src/pages/index.eta"), indexPageContent);

  console.log("\n✨ Project initialized successfully!");
  console.log("Next steps:");
  console.log("  1. Run `cssg dev` to start the development server.");
  console.log("  2. Start building your amazing site!");
}
