// deno-lint-ignore-file no-explicit-any
export async function getRemoteTemplatesList(): Promise<string[]> {
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
      .filter(
        (item: any) =>
          item.type === "dir" &&
          (item.name === "basic" || item.name === "counter")
      )
      .map((item: any) => item.name);

    return templates;
  } catch (error) {
    console.warn(`⚠️ Could not fetch remote templates list: ${error}`);
    return ["basic", "counter"];
  }
}
