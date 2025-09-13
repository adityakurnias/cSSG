import { ensureDir } from "@std/fs/ensure-dir";
import { exists } from "@std/fs/exists";
import * as path from "@std/path";

interface CreateProjectOptions {
  projectName: string;
  targetDir: string;
  template: string;
  force: boolean;
}

const templates = {
  basic: {
    "cssg.config.ts": `import type { UserConfig } from "@adityakurnias/cssg";

const config: UserConfig = {
  site: {
    title: "{{PROJECT_NAME}}",
    description: "A new site generated with cSSG!",
  },
};

export default config;`,

    "deno.json": `{
  "tasks": {
    "dev": "cssg dev",
    "build": "cssg build"
  },
  "imports": {
    "@adityakurnias/cssg": "jsr:@adityakurnias/cssg@^0.0.3-beta"
  }
}`,

    ".gitignore": `# cSSG
dist

# Deno
deno.lock

# Node
node_modules

# IDE
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db`,

    "README.md": `# {{PROJECT_NAME}}

A static site built with [cSSG](https://jsr.io/@adityakurnias/cssg).

## Getting Started

\`\`\`bash
# Install cSSG globally (if not already installed)
deno install -gA jsr:@adityakurnias/cssg

# Start development server
deno task dev
# or
cssg dev

# Build for production
deno task build
# or
cssg build
\`\`\`

## Project Structure

\`\`\`
{{PROJECT_NAME}}/
├── cssg.config.ts      # Configuration file
├── deno.json           # Deno configuration
├── src/
│   ├── layouts/        # Layout templates
│   ├── pages/          # Page content
│   ├── assets/         # Static assets
│   └── data/           # Data files
└── dist/               # Built output (generated)
\`\`\`

## Documentation

- [cSSG Documentation](https://jsr.io/@adityakurnias/cssg)
- [Eta Template Engine](https://eta.js.org/)`,

    "src/layouts/main.eta": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%~ it.site.title %></title>
  <meta name="description" content="<%~ it.site.description %>">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 0 20px; }
    header { background: #f8f9fa; padding: 1rem 0; border-bottom: 1px solid #e9ecef; }
    nav a { margin-right: 1rem; text-decoration: none; color: #495057; }
    nav a:hover { color: #007bff; }
    main { padding: 2rem 0; }
    footer { background: #f8f9fa; padding: 1rem 0; margin-top: 2rem; text-align: center; color: #6c757d; }
  </style>
  <%~ it.head ?? '' %>
</head>
<body>
  <header>
    <div class="container">
      <h1><%~ it.site.title %></h1>
      <nav>
        <a href="<%= it.basePath ?? '' %>/index.html">Home</a>
        <a href="<%= it.basePath ?? '' %>/about.html">About</a>
      </nav>
    </div>
  </header>
  <main>
    <div class="container">
      <%~ it.body %>
    </div>
  </main>
  <footer>
    <div class="container">
      <p>Powered by cSSG</p>
    </div>
  </footer>
  <%~ it.scripts ?? '' %>
</body>
</html>`,

    "src/pages/index.eta": `---
title: "Welcome to {{PROJECT_NAME}}"
layout: "main"
---

<h1>Welcome to Your New Site! 🎉</h1>

<p>This is the home page of your new cSSG site. You can edit this content by modifying the file at <code>src/pages/index.eta</code>.</p>

<h2>What's Next?</h2>

<ul>
  <li>✨ Customize your site configuration in <code>cssg.config.ts</code></li>
  <li>🎨 Modify the layout in <code>src/layouts/main.eta</code></li>
  <li>📝 Add new pages in the <code>src/pages/</code> directory</li>
  <li>🖼️ Add assets to <code>src/assets/</code></li>
  <li>📊 Store data files in <code>src/data/</code></li>
</ul>

<p>Happy building! 🚀</p>`,

    "src/pages/about.eta": `---
title: "About"
layout: "main"
---

<h1>About This Site</h1>

<p>This is a sample about page. You can customize this content by editing <code>src/pages/about.eta</code>.</p>

<p>Built with ❤️ using <a href="https://jsr.io/@adityakurnias/cssg">cSSG</a>.</p>`,
  },

  blog: {
    // Template blog bisa ditambahkan di sini
    // Dengan struktur yang lebih kompleks untuk blog
  },
};

export async function createProject(options: CreateProjectOptions) {
  const { projectName, targetDir, template, force } = options;

  console.log(`\n🚀 Creating new cSSG project: ${projectName}\n`);

  // Check if directory exists and is not empty
  if (await exists(targetDir)) {
    if (!force) {
      // Check if directory is empty
      let isEmpty = true;
      try {
        for await (const _ of Deno.readDir(targetDir)) {
          isEmpty = false;
          break;
        }
      } catch {
        // Directory might not exist or not accessible, proceed
      }

      if (!isEmpty) {
        console.error(
          `❌ Directory "${projectName}" already exists and is not empty.`
        );
        console.log(`Use --force to overwrite or choose a different name.`);
        Deno.exit(1);
      }
    } else {
      console.log(`⚠️  Overwriting existing directory...`);
    }
  }

  // Ensure target directory
  await ensureDir(targetDir);

  // Create directory structure
  const dirs = ["src", "src/pages", "src/layouts", "src/data", "src/assets"];
  for (const dir of dirs) {
    const dirPath = path.join(targetDir, dir);
    await ensureDir(dirPath);
  }

  // Get template files
  const templateFiles = templates[template as keyof typeof templates];
  if (!templateFiles) {
    throw new Error(
      `Template "${template}" not found. Available templates: ${Object.keys(
        templates
      ).join(", ")}`
    );
  }

  // Create files from template
  for (const [filePath, content] of Object.entries(templateFiles)) {
    const fullPath = path.join(targetDir, filePath);
    const dir = path.dirname(fullPath);
    await ensureDir(dir);

    // Replace placeholders
    const processedContent = content.replace(
      /\{\{PROJECT_NAME\}\}/g,
      projectName
    );

    await Deno.writeTextFile(fullPath, processedContent);
    console.log(`✅ Created: ${path.relative(Deno.cwd(), fullPath)}`);
  }
}
