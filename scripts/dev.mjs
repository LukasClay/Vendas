import { spawn } from "node:child_process";

const child = spawn("tsx", ["watch", "server/_core/index.ts"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: "development",
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
