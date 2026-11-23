// One-time local setup: env file, Docker services, database schema + demo data, shared packages.
// Safe to re-run. Usage: pnpm first-run
import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

const run = (cmd) => {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example");
}

try {
  execSync("docker info", { stdio: "ignore" });
} catch {
  console.error("\nDocker isn't running. Start it first (on this Mac: `colima start`), then re-run `pnpm first-run`.");
  process.exit(1);
}

run("docker compose up -d --wait");
run("pnpm db:deploy");
run("pnpm db:seed");
run("pnpm --filter @students/shared --filter @students/db build");

console.log(`
✔ Ready.
  pnpm dev       → API (http://localhost:4000) + landlord dashboard (http://localhost:3000)
  pnpm mobile    → student app (press w for web, or scan the QR code with Expo Go)
`);
