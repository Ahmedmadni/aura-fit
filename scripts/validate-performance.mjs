import fs from "node:fs";
import path from "node:path";

const assetsDir = path.resolve(".output/public/assets");
const entryBudgetBytes = 500 * 1024;

if (!fs.existsSync(assetsDir)) {
  throw new Error(
    "Performance validation requires a completed production build at .output/public/assets.",
  );
}

const files = fs.readdirSync(assetsDir);
const entryCandidates = files.filter((name) => /^index-[\w-]+\.js$/.test(name));

if (!entryCandidates.length) {
  throw new Error(
    "Could not find the production client entry chunk (index-*.js).",
  );
}

const entries = entryCandidates
  .map((name) => ({
    name,
    bytes: fs.statSync(path.join(assetsDir, name)).size,
  }))
  .sort((a, b) => b.bytes - a.bytes);

const entry = entries[0];
const kb = (entry.bytes / 1024).toFixed(1);
const budgetKb = (entryBudgetBytes / 1024).toFixed(0);

if (entry.bytes > entryBudgetBytes) {
  throw new Error(
    `Client entry budget exceeded: ${entry.name} is ${kb} KiB; budget is ${budgetKb} KiB. Keep heavyweight exercise/workout data out of the initial app shell.`,
  );
}

console.log(
  `Performance budget PASS: ${entry.name} is ${kb} KiB <= ${budgetKb} KiB.`,
);
