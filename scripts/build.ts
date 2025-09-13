import { Eta } from "@eta-dev/eta";
import { ensureDir, emptyDir } from "@std/fs";
import { join } from "@std/path";

const eta = new Eta({ views: join(Deno.cwd(), "./src") });

// Memastikan dist bersih
const dist = join(Deno.cwd(), "dist");
await emptyDir(dist);
await ensureDir(dist);

// Mengambil data dari projects.json
const projects = JSON.parse(await Deno.readTextFile("./src/data/projects.json"));

// Merender
const body = eta.render("./templates/index.eta", { projects })!;
const html = eta.render("./templates/layout.eta", { title: "My Projects", body })!;

// Write ke dist
await Deno.writeTextFile(join(dist, "index.html"), html);

console.log("✅ Build selesai! File ada di dist/index.html");
