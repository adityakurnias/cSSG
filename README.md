# cSSG - c Static Site Generator

![Made with Deno](https://img.shields.io/badge/made%20with-deno-000000.svg?style=for-the-badge\&logo=deno\&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

**cSSG** is a simple Static Site Generator (SSG) built on top of Deno and TypeScript. Designed for ease of use (maybe) and speed (I'm not sure), cSSG lets you create static websites quickly without complex configurations (Nahh).

## ✨ Features

* **Built with Deno**: Enjoy a secure and modern runtime environment for JavaScript and TypeScript.
* **Fast Build**: Powered by **esbuild** to process JavaScript and CSS assets at lightning speed.
* **Live Reload**: Built-in development server with *hot-reloading* for a smooth workflow (Again, I'm not sure).
* **Powerful Templating**: Uses the **Eta** template engine, fast and compatible with EJS.
* **Project Scaffolding**: Quickly bootstrap new projects with the `create` command.
* **Remote Templates**: Use ready-to-go templates.

## 📋 Prerequisites

Before getting started, make sure you have installed:

1. **Deno**
2. **Git**: Required to clone templates from repositories.

## 🚀 Installation

Install the cSSG CLI globally using Deno:

```bash
deno install -A --global --name cssg jsr:@adityakurnias/cssg
```
#### or specify the version
```bash
deno install -A --global --name cssg jsr:@adityakurnias/cssg@0.0.450
```

> **Note**: Ensure that Deno’s installation directory is added to your system `PATH` so that the `cssg` command can be accessed globally.

## 📖 Usage

### 1. Create a New Project

To create a new project, use the `create` command followed by your project name:

```bash
cssg create <project-name>
```

Example:

```bash
cssg create cSSG-site
```

You can also select a specific template from a remote repository using the `--template` flag:

```bash
cssg create cSSG-site --template counter
```

Check available templates with `cssg list`.

### 2. Run Development Server

Navigate into your project directory and start the dev server with the `dev` command:

```bash
cd cSSG-site
cssg dev
```

The server will run at `http://localhost:3000` and automatically reload the page whenever you save changes in your project files.

### 3. Build the Site for Production

To generate a production-ready version of your site, run:

```bash
cssg build
```

Static files ready for deployment will be output to the `dist` directory (or another directory specified in your config).

## 📁 Project Structure

A newly created cSSG project comes with the following structure:

```
.
├── public/
│   └── favicon.ico       # Static assets, copied directly to output
├── src/
│   ├── assets/
│   │   ├── main.css      # Processed assets (CSS, JS)
│   │   └── main.js
│   ├── data/
│   │   └── site.json     # JSON data files, accessible in templates
│   ├── layouts/
│   │   └── main.eta      # Layout templates
│   └── pages/
│       └── index.eta     # Content pages
└── cssg.config.ts        # Main project configuration file
```

* **`public/`**: For static files such as images or `robots.txt`. Contents are copied directly to the output directory.
* **`src/assets/`**: For CSS/JS assets that will be bundled by esbuild.
* **`src/data/`**: Place `.json` files here. They are merged and accessible in templates via the `site` object.
* **`src/layouts/`**: Contains Eta layout templates. Pages can inherit from these.
* **`src/pages/`**: Your main content files (`.eta` or `.html`). Each file here becomes a page in your site.
* **`cssg.config.ts`**: Customize input/output directories and global site data.

## ⚙️ Configuration

You can configure cSSG behavior via `cssg.config.ts`.

Example:

```typescript
import type { UserConfig } from "@adityakurnias/cssg";

const config: UserConfig = {
  // Output directory
  outDir: "build",

  // Directory for static assets
  publicDir: "static",

  // Global site data available in all pages
  site: {
    title: "My Awesome Site",
    description: "A website built with cSSG.",
  },
});

export default config;
```

## 🤝 Contributing

Contributions are welcome! If you find a bug or have an idea for a new feature, please open an *issue* or submit a *pull request* on the GitHub repository.
###### please don't

## 📄 License

This project is licensed under the MIT License.

---
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>


###### sorry