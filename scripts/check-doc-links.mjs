import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const ignoredDirectories = new Set([".git", "dist", "node_modules", "playwright-report", "test-results"]);

function listMarkdownFiles(directory = ".") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return [];
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(file);
    return extname(entry.name).toLowerCase() === ".md" ? [file.replace(/^\.\//, "")] : [];
  });
}

let markdownFiles;
try {
  markdownFiles = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "*.md"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
    .split("\n")
    .filter((file) => file && existsSync(file));
} catch {
  markdownFiles = listMarkdownFiles();
}

const failures = [];
const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;

for (const file of markdownFiles) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(linkPattern)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
    if (!rawTarget || /^(?:https?:|mailto:|#)/i.test(rawTarget)) continue;
    const target = decodeURIComponent(rawTarget.split("#")[0]);
    const absolute = resolve(dirname(file), target);
    if (!existsSync(absolute)) {
      const line = source.slice(0, match.index).split("\n").length;
      failures.push(`${file}:${line} -> ${rawTarget}`);
    }
  }
}

if (failures.length) {
  console.error("Broken local Markdown links:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Documentation links passed (${markdownFiles.length} Markdown files checked).`);
}
