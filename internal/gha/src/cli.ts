import { commands, usage } from "./commands/index.ts";

const [name, ...argv] = process.argv.slice(2);
const command = name === undefined ? undefined : commands[name];

if (!command) {
  console.error(usage());
  process.exit(1);
}

try {
  await command.run(argv);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
