import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {EXPERIMENT_FLAGS} from '../nlui/features.ts';
import {toolsForQueryArm} from '../nlui/toolDefinitions.ts';

export const currentDocumentation = (root: string): Record<string, string> => Object.fromEntries([
    'README.md', 'docs/verification.md', 'data/README.md',
    ...readdirSync(join(root, 'public/docs')).filter((name) => name.endsWith('.md')).map((name) => `public/docs/${name}`)
].map((path) => [path, readFileSync(join(root, path), 'utf8')]));

// Check current operator docs, not dated historical reviews or frozen experiments.
export const verifyDocumentation = (root: string, documents = currentDocumentation(root)): string[] =>
{
    const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts as Record<string, string>;
    const issues: string[] = [];
    for (const [path, text] of Object.entries(documents))
    {
        for (const [, command] of text.matchAll(/\bbun run ([a-z][a-z0-9:./_-]*)/g))
            if (!(command! in scripts) && !existsSync(resolve(root, command!))) issues.push(`${path}: unknown Bun command ${command}`);
        for (const [, target] of text.matchAll(/\]\(([^)]+)\)/g))
        {
            const link = target!.split('#')[0]!;
            if (!link || /^(?:https?:|mailto:)/.test(link) || link === '/') continue;
            const destination = link === '/docs' ? join(root, 'public/docs/readme.md') : link.startsWith('/docs/')
                ? join(root, 'public/docs', `${link.slice(6)}.md`) : link.startsWith('/') ? join(root, link.slice(1))
                    : resolve(root, dirname(path), link);
            if (!existsSync(destination)) issues.push(`${path}: missing link ${link}`);
        }
    }
    const tools = [...new Set([...toolsForQueryArm('control', true), ...toolsForQueryArm('semantic')].map(({name}) => name))].sort();
    const documented = [...(documents['public/docs/readme.md'] ?? '').matchAll(/^\| `([a-z_]+)` \|/gm)].map((match) => match[1]!).sort();
    if (JSON.stringify(tools) !== JSON.stringify(documented)) issues.push('public/docs/readme.md: domain tool catalog drift');
    const served = Object.entries(documents).filter(([path]) => path.startsWith('public/docs/')).map(([, text]) => text).join('\n');
    for (const flag of Object.values(EXPERIMENT_FLAGS)) if (!served.includes(`\`${flag}=1\``)) issues.push(`public/docs: missing feature ${flag}`);
    return issues;
};
