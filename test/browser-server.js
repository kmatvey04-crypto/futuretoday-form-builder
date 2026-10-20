import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server.js";
const dir = mkdtempSync(join(tmpdir(), "futuretoday-e2e-"));
const server = createApp({ dataFile: join(dir, "store.json") }).listen(
  3197,
  "127.0.0.1",
);
function close() {
  server.close(() => {
    rmSync(dir, { recursive: true, force: true });
    process.exit(0);
  });
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
