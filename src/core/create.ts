import { ensureDir } from "@std/fs/ensure-dir";
import { exists, walk } from "@std/fs";
import * as path from "@std/path";

interface CreateProjectOptions {
  projectName: string;
  targetDir: string;
  template: string;
  force: boolean;
}

const TEMPLATE_ARCHIVE_URL =
  "https://github.com/adityakurnias/cssg-templates/archive/refs/heads/main.zip";

// Function to download file from URL
async function downloadFile(
  url: string,
  destinationPath: string
): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to download: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    await Deno.writeFile(destinationPath, new Uint8Array(arrayBuffer));
  } catch (error) {
    throw new Error(`Download failed: ${error}`);
  }
}

// Function to extract ZIP file using Deno's built-in capabilities
async function extractZip(zipPath: string, extractDir: string): Promise<void> {
  // Use the system's unzip command
  const command = new Deno.Command("unzip", {
    args: ["-q", zipPath, "-d", extractDir],
  });

  const { success } = await command.output();

  if (!success) {
    throw new Error(
      "Failed to extract ZIP file. Make sure 'unzip' is installed."
    );
  }
}

// Function to download and extract template archive
async function downloadRemoteTemplate(
  template: string,
  tempDir: string
): Promise<string> {
  console.log(`📥 Downloading template "${template}" from remote...`);

  const zipPath = path.join(tempDir, "template.zip");

  try {
    // Download the archive
    await downloadFile(TEMPLATE_ARCHIVE_URL, zipPath);
    console.log(`✅ Template archive downloaded`);

    // Extract the archive
    const extractDir = path.join(tempDir, "extracted");
    await ensureDir(extractDir);

    // Extract zip file using our custom function
    await extractZip(zipPath, extractDir);

    // Find the template directory in extracted files
    // GitHub archives extract to "repository-name-branch" format
    const extractedRepoDir = path.join(extractDir, "cssg-templates-main");
    const templateDir = path.join(extractedRepoDir, template);

    if (!(await exists(templateDir, { isDirectory: true }))) {
      throw new Error(`Template "${template}" not found in remote repository`);
    }

    console.log(`✅ Template extracted successfully`);
    return templateDir;
  } catch (error) {
    // Cleanup on error
    try {
      await Deno.remove(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
    throw new Error(`Failed to download remote template: ${error}`);
  }
}

// Function to get available remote templates
async function getRemoteTemplatesList(): Promise<string[]> {
  try {
    const apiUrl =
      "https://api.github.com/repos/adityakurnias/cssg-templates/contents";
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const contents = await response.json();
    if (!Array.isArray(contents)) {
      throw new Error(
        `Unexpected API response format. Message: ${contents.message}`
      );
    }
    
    const templates = contents
      .filter((item: any) => item.type === "dir" && (item.name === "basic" || item.name === "counter"))
      .map((item: any) => item.name);

    return templates;
  } catch (error) {
    console.warn(`⚠️ Could not fetch remote templates list: ${error}`);
    return ["basic", "counter"]; // Fallback 
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
      console.log(`⚠️ Overwriting existing directory...`);
    }
  }

  // Ensure target directory
  await ensureDir(targetDir);

  let templateSourceDir: string;
  let tempDir: string | null = null;

  // Selalu gunakan remote template
  tempDir = await Deno.makeTempDir({ prefix: "cssg_template_" });

  try {
    // Get remote templates list
    const availableTemplates = await getRemoteTemplatesList();

    if (!availableTemplates.includes(template)) {
      throw new Error(
        `Template "${template}" not found. Available templates: ${availableTemplates.join(
          ", "
        )}`
      );
    }
    
    // Download the template files
    templateSourceDir = await downloadRemoteTemplate(template, tempDir);
  } catch (error) {
    if (tempDir) {
      try {
        await Deno.remove(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    throw error;
  }

  try {
    // Walk the template directory and copy files
    for await (const entry of walk(templateSourceDir, { includeDirs: false })) {
      const relativePath = path.relative(templateSourceDir, entry.path);
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

    console.log(`\n🎉 Project "${projectName}" created successfully!`);
    console.log(`📦 Template "${template}" downloaded from remote repository`);

  } finally {
    // Cleanup temporary directory
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

// Helper function to list available templates
export async function listTemplates(): Promise<void> {
  console.log(`\n📋 Available templates:\n`);

  console.log(`🌐 Remote templates:`);
  const remoteTemplates = await getRemoteTemplatesList();

  if (remoteTemplates.length === 0) {
    console.log(`   No remote templates found.`);
  } else {
    remoteTemplates.forEach((template) => {
      console.log(`   • ${template}`);
    });
  }

  console.log();
}