import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const uiDir = join(root, "ui");
const viteBin = join(uiDir, "node_modules", "vite", "bin", "vite.js");

const children = [];

function start(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: process.env.PORT || "3000",
    },
  });

  children.push(child);

  child.on("exit", (code, signal) => {
    if (signal || code === 0) return;
    console.error(`[${name}] exited with code ${code}`);
    shutdown(code);
  });

  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("api", process.execPath, ["server.js"], root);
start("ui", process.execPath, [viteBin, "--host", "127.0.0.1", "--config", "vite.config.js"], uiDir);
