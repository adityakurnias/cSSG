export async function clone(
  url: string,
  destinationPath: string
): Promise<void> {
  try {
    const clone = new Deno.Command("git", {
      args: ["clone", "--depth", "1", url, destinationPath],
    });
    const { success, stderr } = await clone.output();

    if (!success) {
      // Provide more context on failure.
      const errorOutput = new TextDecoder().decode(stderr);
      throw new Error(`Git clone failed: ${errorOutput}`);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        `Download failed: 'git' command not found. Please ensure Git is installed and in your PATH.`
      );
    }
    throw new Error(`Download failed: ${error}`);
  }
}
