import { resolve } from "node:path";
import { ensureDemoDatabase } from "../src/data/index.ts";

function databasePathFromArguments(arguments_: string[]): string | undefined {
    const index = arguments_.indexOf("--database");
    const value = index >= 0 ? arguments_[index + 1] : undefined;
    if (index >= 0 && !value) throw new Error("--database requires a path");
    return value ? resolve(value) : undefined;
}

const result = ensureDemoDatabase({ databasePath: databasePathFromArguments(Bun.argv.slice(2)) });
console.log(JSON.stringify(result, null, 2));
