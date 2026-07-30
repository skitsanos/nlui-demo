import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export interface PolicyDocumentSeed {
    id: string;
    title: string;
    tags: string;
    body: string;
    sourcePath: string;
}

function documentTitle(markdown: string, filename: string): string {
    const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
    return heading ?? basename(filename, ".md").replaceAll("-", " ");
}

function documentTags(markdown: string): string {
    const tags = markdown.match(/^Tags:\s*(.+)$/im)?.[1]?.trim();
    return tags ?? "retail,help";
}

export function loadPolicyDocuments(knowledgePath: string): PolicyDocumentSeed[] {
    return readdirSync(knowledgePath, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
        .map((entry) => entry.name)
        .sort()
        .map((filename) => {
            const markdown = readFileSync(join(knowledgePath, filename), "utf8").trim();
            return {
                id: basename(filename, ".md"),
                title: documentTitle(markdown, filename),
                tags: documentTags(markdown),
                body: markdown,
                sourcePath: `knowledge/${filename}`,
            };
        });
}
