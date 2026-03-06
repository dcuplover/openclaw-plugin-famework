import { promises as fs } from "node:fs";
import path from "node:path";

const [, , sourceRootArg, outputArg] = process.argv;

if (!sourceRootArg || !outputArg) {
  console.error("Usage: node generate-registry.mjs <source-root> <output-file>");
  process.exit(1);
}

const cwd = process.cwd();
const sourceRoot = path.resolve(cwd, sourceRootArg);
const outputFile = path.resolve(cwd, outputArg);

const groups = [
  { key: "modules", directory: "modules", suffix: ".module.ts" },
  { key: "tools", directory: "tools", suffix: ".tool.ts" },
  { key: "hooks", directory: "hooks", suffix: ".hook.ts" },
  { key: "commands", directory: "commands", suffix: ".command.ts" },
];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function toImportPath(filePath) {
  const relative = path.relative(path.dirname(outputFile), filePath).replace(/\\/g, "/");
  const withoutExtension = relative.replace(/\.ts$/, "");
  return withoutExtension.startsWith(".") ? withoutExtension : `./${withoutExtension}`;
}

async function collect(group) {
  const baseDir = path.join(sourceRoot, group.directory);
  try {
    const files = await walk(baseDir);
    return files
      .filter((file) => file.endsWith(group.suffix))
      .sort((left, right) => left.localeCompare(right))
      .map((file) => `  () => import(\"${toImportPath(file)}\")`);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

const lines = [
  "import type { DefinitionRegistry } from \"../framework/core/types\";",
  "",
  "export const registry: DefinitionRegistry = {",
];

for (const group of groups) {
  const entries = await collect(group);
  lines.push(`  ${group.key}: [`);
  if (entries.length > 0) {
    lines.push(...entries.map((entry) => `${entry},`));
  }
  lines.push("  ],");
}

lines.push("};", "");

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, `${lines.join("\n")}`, "utf8");
console.log(`Generated registry at ${outputFile}`);
