import { ensureDir } from "@std/fs/ensure-dir";
import { exists, walk } from "@std/fs";
import * as path from "@std/path";

interface CreateProjectOptions {
  projectName: string;
  targetDir: string;
  template: string;
  force: boolean;
}

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

  // Get template source directory
  // Use Deno.mainModule which consistently points to the file path
  // of the main script, whether run locally or installed.
  // This avoids issues with import.meta.url being an https:// URL.
  const moduleDir = path.dirname(path.fromFileUrl(import.meta.url));
  const templateSourceDir = path.resolve(moduleDir, "templates");
  const availableTemplates = [];
  for await (const entry of Deno.readDir(templateSourceDir)) {
    if (entry.isDirectory) {
      availableTemplates.push(entry.name);
    }
  }

  const specificTemplateDir = path.join(templateSourceDir, template);
  if (
    !availableTemplates.includes(template) ||
    !(await exists(specificTemplateDir, { isDirectory: true }))
  ) {
    throw new Error(
      `Template "${template}" not found. Available templates: ${availableTemplates.join(
        ", "
      )}`
    );
  }

  // Walk the template directory and copy files
  for await (const entry of walk(specificTemplateDir, { includeDirs: false })) {
    const relativePath = path.relative(specificTemplateDir, entry.path);
    const destinationPath = path.join(targetDir, relativePath);

    await ensureDir(path.dirname(destinationPath));
    const content = await Deno.readTextFile(entry.path);

    // Replace placeholders
    const processedContent = content.replace(
      /\{\{PROJECT_NAME\}\}/g,
      projectName
    );

    await Deno.writeTextFile(destinationPath, processedContent);
    console.log(`✅ Created: ${path.relative(Deno.cwd(), destinationPath)}`);
  }
}
