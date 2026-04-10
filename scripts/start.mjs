import { spawn } from "node:child_process";

const child = spawn("node", ["dist/index.js"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: "production",
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
