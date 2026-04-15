import { rmSync, existsSync } from "fs";

for (const file of ["package-lock.json", "yarn.lock"]) {
  if (existsSync(file)) {
    rmSync(file, { force: true });
  }
}

const agent = process.env.npm_config_user_agent || "";
if (!agent.startsWith("pnpm/")) {
  process.stderr.write("Use pnpm instead\n");
  process.exit(1);
}
