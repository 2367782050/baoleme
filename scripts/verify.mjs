import { spawn } from "node:child_process";

const pipelines = {
  unit: [
    ["npm", ["run", "lint"]],
    ["npm", ["run", "typecheck"]],
    ["npm", ["run", "test"]],
  ],
  e2e: [
    ["npx", ["playwright", "test", "--workers=1"]],
  ],
  all: [
    ["npm", ["run", "db:generate"]],
    ["npm", ["run", "db:migrate"]],
    ["npm", ["run", "db:seed"]],
    ["npm", ["run", "lint"]],
    ["npm", ["run", "typecheck"]],
    ["npm", ["run", "test"]],
    ["npm", ["run", "test"]],
    ["npm", ["run", "build"]],
    ["npx", ["playwright", "test", "--workers=1"]],
  ],
};

const name = process.argv[2];
const pipeline = pipelines[name];

if (!pipeline) {
  console.error("Usage: node scripts/verify.mjs <unit|e2e|all>");
  process.exit(1);
}

function resolveCommand(command, args) {
  if (command === "npm") {
    const npmCli = process.env.npm_execpath;
    if (!npmCli) throw new Error("npm_execpath is not available; run this script through npm.");
    return [process.execPath, [npmCli, ...args]];
  }

  if (command === "npx" && args[0] === "playwright") {
    return [process.execPath, ["node_modules/@playwright/test/cli.js", ...args.slice(1)]];
  }

  return [command, args];
}

async function stopPort(port) {
  const command = process.platform === "win32"
    ? ["powershell.exe", [
      "-NoProfile",
      "-Command",
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }`,
    ]]
    : ["sh", ["-lc", `if command -v lsof >/dev/null 2>&1; then lsof -ti tcp:${port} | xargs -r kill -9; fi`]];

  await new Promise((resolve) => {
    const child = spawn(command[0], command[1], { stdio: "ignore" });
    child.on("exit", resolve);
    child.on("error", resolve);
  });
}

for (const [command, args] of pipeline) {
  if (command === "npx" && args[0] === "playwright") {
    await stopPort(3000);
  }

  const [executable, executableArgs] = resolveCommand(command, args);
  console.log(`\n> ${command} ${args.join(" ")}`);
  const code = await new Promise((resolve) => {
    const child = spawn(executable, executableArgs, {
      stdio: "inherit",
      env: { ...process.env, PLAYWRIGHT_REUSE_SERVER: "0" },
    });
    child.on("exit", resolve);
    child.on("error", () => resolve(1));
  });

  if (code !== 0) {
    process.exit(code ?? 1);
  }
}
