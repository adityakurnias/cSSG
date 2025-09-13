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

export async function init(targetRoot: string) {
  const isCurrentDir = targetRoot === Deno.cwd();
  const projectName = path.basename(targetRoot);
  const relativePath = path.relative(Deno.cwd(), targetRoot);

  console.log(
    `\n🚀 Initializing new cSSG project in ${
      isCurrentDir ? "current directory" : `\`${relativePath}\``
    }...\n`
  );

  // Pastikan direktori target ada sebelum memeriksa isinya
  await ensureDir(targetRoot);

  // Periksa apakah direktori target kosong.
  let isEmpty = true;
  for await (const _ of Deno.readDir(targetRoot)) {
    isEmpty = false;
    break;
  }

  if (!isEmpty) {
    console.error(
      `❌ Direktori target "${relativePath}" tidak kosong. Silakan gunakan direktori yang kosong.`
    );
    Deno.exit(1);
  }

  const dirs = ["src", "src/pages", "src/layouts", "src/data", "src/assets"];
  for (const dir of dirs) {
    const dirPath = path.join(targetRoot, dir);
    await ensureDir(dirPath);
    console.log(`✅ Created directory: ${path.relative(Deno.cwd(), dirPath)}`);
  }

  await writeFile(path.join(targetRoot, "cssg.config.ts"), cssgConfigContent);
  await writeFile(path.join(targetRoot, ".gitignore"), gitignoreContent);
  await writeFile(
    path.join(targetRoot, "src/layouts/main.eta"),
    mainLayoutContent
  );
  await writeFile(
    path.join(targetRoot, "src/pages/index.eta"),
    indexPageContent
  );

  console.log("\n✨ Project initialized successfully!");
  console.log("Next steps:");
  if (!isCurrentDir) {
    console.log(`  1. cd ${relativePath}`);
  }
  console.log(
    `  ${
      isCurrentDir ? "1." : "2."
    } Run \`cssg dev\` to start the development server.`
  );
  console.log(
    `  ${isCurrentDir ? "2." : "3."} Start building your amazing site!`
  );
}
