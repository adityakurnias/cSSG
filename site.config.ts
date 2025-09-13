import projects from "./src/data/projects.json" with { type: "json" };

export const config = {
  site: {
    title: "My Projects",
    description: "SSG mini pakai Deno + Eta",
    projects,
  },
};
