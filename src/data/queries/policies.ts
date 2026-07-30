import type { Database } from "bun:sqlite";
import type { PolicyMatch } from "../types.ts";
import { clampInteger } from "./helpers.ts";

interface PolicyRow {
    id: string;
    title: string;
    tags: string;
    body: string;
    sourcePath: string;
}

interface MarkdownSection {
    heading: string;
    text: string;
}

const STOP_WORDS = new Set(["a", "an", "and", "are", "can", "do", "for", "how", "i", "is", "my", "of", "the", "to", "what"]);

function terms(value: string): string[] {
    return [
        ...new Set(
            value
                .toLowerCase()
                .replaceAll(/[^\p{L}\p{N}-]+/gu, " ")
                .split(/\s+/)
                .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
        ),
    ];
}

function sections(markdown: string): MarkdownSection[] {
    const result: MarkdownSection[] = [];
    let heading = "Overview";
    let lines: string[] = [];
    const flush = () => {
        const text = lines.join("\n").trim();
        if (text) result.push({ heading, text });
        lines = [];
    };
    for (const line of markdown.split("\n")) {
        const match = line.match(/^#{2,3}\s+(.+)$/);
        if (match?.[1]) {
            flush();
            heading = match[1].trim();
        } else if (!line.startsWith("# ") && !line.startsWith("Tags:")) {
            lines.push(line);
        }
    }
    flush();
    return result;
}

function sectionScore(document: PolicyRow, section: MarkdownSection, queryTerms: string[]): number {
    const title = document.title.toLowerCase();
    const tags = document.tags.toLowerCase();
    const heading = section.heading.toLowerCase();
    const body = section.text.toLowerCase();
    return queryTerms.reduce((score, term) => {
        if (title.includes(term)) score += 5;
        if (tags.includes(term)) score += 4;
        if (heading.includes(term)) score += 3;
        if (body.includes(term)) score += 1;
        return score;
    }, 0);
}

function excerpt(text: string, queryTerms: string[]): string {
    const plainText = text.replaceAll(/\s+/g, " ").trim();
    const lower = plainText.toLowerCase();
    const firstMatch = queryTerms.map((term) => lower.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
    const start = Math.max(0, firstMatch - 80);
    const end = Math.min(plainText.length, start + 280);
    return `${start > 0 ? "…" : ""}${plainText.slice(start, end).trim()}${end < plainText.length ? "…" : ""}`;
}

export function queryPolicies(database: Database, query: string, limit = 5): PolicyMatch[] {
    const queryTerms = terms(query);
    if (!queryTerms.length) return [];
    const documents = database
        .query<PolicyRow, []>(
            "SELECT id, title, tags, body, source_path AS sourcePath FROM policy_documents ORDER BY id",
        )
        .all();
    return documents
        .flatMap((document) =>
            sections(document.body).map((section) => ({
                documentId: document.id,
                title: document.title,
                section: section.heading,
                excerpt: excerpt(section.text, queryTerms),
                score: sectionScore(document, section, queryTerms),
                sourcePath: document.sourcePath,
            })),
        )
        .filter((match) => match.score > 0)
        .sort((left, right) => right.score - left.score || left.documentId.localeCompare(right.documentId))
        .slice(0, clampInteger(limit, 5, 1, 10));
}
