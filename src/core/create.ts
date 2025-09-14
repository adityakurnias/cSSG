import { ensureDir } from "@std/fs/ensure-dir";
import { exists, walk } from "@std/fs";
import * as path from "@std/path";
import { clone } from "../utils/clone.ts";
import { getRemoteTemplatesList } from "../utils/getTemplate.ts";

interface CreateProjectOptions {
  projectName: string;
  targetDir: string;
  template: string;
  force: boolean;
}

const TEMPLATE_URL = "https://github.com/adityakurnias/cssg-templates.git";

async function downloadRemoteTemplate(
  template: string,
  tempDir: string
): Promise<string> {
  console.log(`📥 Cloning template repository...`);

  try {
    // The repository will be cloned into the temp directory.
    await clone(TEMPLATE_URL, tempDir);
    console.log(`✅ Template repository cloned successfully`);

    const templateDir = path.join(tempDir, template);

    if (!(await exists(templateDir, { isDirectory: true }))) {
      throw new Error(`Template "${template}" not found in remote repository`);
    }

    console.log(`✅ Template extracted successfully`);
    return templateDir;
  } catch (error) {
    // Cleanup the temp directory on failure.
    try {
      await Deno.remove(tempDir, { recursive: true });
    } catch {
      // Ignore errors
    }
    throw new Error(`Failed to download remote template: ${error}`);
  }
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
        //
      }

      if (!isEmpty) {
        console.error(
          `❌ Directory "${projectName}" already exists and is not empty.`
        );
        console.log(`Use --force to overwrite or choose a different name.`);
        Deno.exit(1);
      }
    } else {
      console.log(`⚠️ Overwriting existing directory...`);
    }
  }

  await ensureDir(targetDir);

  let templateSourceDir: string;
  let tempDir: string | null = null;

  tempDir = await Deno.makeTempDir({ prefix: "cssg_template_" });

  try {
    const availableTemplates = await getRemoteTemplatesList();

    if (!availableTemplates.includes(template)) {
      throw new Error(
        `Template "${template}" not found. Available templates: ${availableTemplates.join(
          ", "
        )}`
      );
    }

    templateSourceDir = await downloadRemoteTemplate(template, tempDir);
  } catch (error) {
    if (tempDir) {
      try {
        await Deno.remove(tempDir, { recursive: true });
      } catch {
        //
      }
    }
    throw error;
  }

  try {
    const textFileExtensions = [".eta", ".html", ".css", ".js", ".md", ".json"];

    // Walk the template directory and copy files
    for await (const entry of walk(templateSourceDir, { includeDirs: false })) {
      const relativePath = path.relative(templateSourceDir, entry.path);
      const destinationPath = path.join(targetDir, relativePath);

      await ensureDir(path.dirname(destinationPath));

      // Check if the file is a text file based on its extension
      if (textFileExtensions.includes(path.extname(entry.path))) {
        const content = await Deno.readTextFile(entry.path);
        const processedContent = content.replace(
          /\{\{PROJECT_NAME\}\}/g,
          projectName
        );
        await Deno.writeTextFile(destinationPath, processedContent);
      } else {
        await Deno.copyFile(entry.path, destinationPath);
      }

      console.log(`✅ Created: ${path.relative(Deno.cwd(), destinationPath)}`);
    }

    console.log(`\n🎉 Project "${projectName}" created successfully!`);
    console.log(`📦 Template "${template}" downloaded from remote repository`);
  } finally {
    // Cleanup
    if (tempDir) {
      try {
        await Deno.remove(tempDir, { recursive: true });
        console.log(`🧹 Cleaned up temporary files`);
      } catch (error) {
        console.warn(`⚠️ Could not clean up temp directory: ${error}`);
      }
    }
  }
}
