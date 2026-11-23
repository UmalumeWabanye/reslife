// Points the student app and file uploads at this computer's Wi-Fi address, so the app
// works in Expo Go on a real phone (a phone can't reach "localhost" on your computer).
// Usage: pnpm phone-env          → use your current Wi-Fi IP
//        pnpm phone-env --reset  → back to localhost (simulator / web only)
// Re-run it if your IP changes (e.g. different Wi-Fi network). Restart `pnpm dev` and `pnpm mobile` afterwards.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

const reset = process.argv.includes("--reset");

function lanIp() {
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === "IPv4" && !a.internal && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(a.address)) return a.address;
    }
  }
  return null;
}

const host = reset ? "localhost" : lanIp();
if (!host) {
  console.error("Couldn't find a Wi-Fi/LAN IP. Are you connected to a network?");
  process.exit(1);
}

function setVar(file, key, value) {
  let text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const line = `${key}=${value}`;
  text = new RegExp(`^${key}=.*$`, "m").test(text) ? text.replace(new RegExp(`^${key}=.*$`, "m"), line) : `${text.trimEnd()}\n${line}\n`.trimStart();
  writeFileSync(file, text);
}

if (!existsSync(".env")) {
  console.error("No .env yet. Run `pnpm first-run` first.");
  process.exit(1);
}

// Presigned upload URLs must use an address the phone can reach.
setVar(".env", "S3_ENDPOINT", `http://${host}:9000`);
setVar("apps/mobile/.env", "EXPO_PUBLIC_API_URL", `http://${host}:4000`);

console.log(`API and uploads now use ${host}. Restart \`pnpm dev\` and \`pnpm mobile\`.`);
if (!reset) console.log("Your phone must be on the same Wi-Fi as this computer.");
