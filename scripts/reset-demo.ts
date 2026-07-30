import { resolve } from "node:path";
import { DEFAULT_DATABASE_PATH, resetDemoDatabase } from "../src/data/index.ts";

function databasePathFromArguments(arguments_: string[]): string | undefined {
    const index = arguments_.indexOf("--database");
    const value = index >= 0 ? arguments_[index + 1] : undefined;
    if (index >= 0 && !value) throw new Error("--database requires a path");
    return value ? resolve(value) : undefined;
}

const databasePath = databasePathFromArguments(Bun.argv.slice(2)) ?? DEFAULT_DATABASE_PATH;
const summary = resetDemoDatabase({ databasePath });
console.log(JSON.stringify({ databasePath, reset: true, summary }, null, 2));
