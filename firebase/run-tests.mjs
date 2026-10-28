import { spawnSync } from "node:child_process";
const first = spawnSync(
  process.execPath,
  ["--test", "firebase/rules.test.mjs"],
  { stdio: "inherit" },
);
if (first.status) process.exit(first.status ?? 1);
const second = spawnSync(
  "npm.cmd",
  ["test", "--", "src/core/cloud.integration.test.ts"],
  { stdio: "inherit", shell: true },
);
process.exit(second.status ?? 1);
