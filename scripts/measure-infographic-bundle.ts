import {resolve} from 'node:path';

// Reproducible build-size probe, not HTTP transfer, load latency or a historical release baseline.
const options = {entrypoints: [resolve(import.meta.dir, '../src/client/main.tsx')], target: 'browser' as const,
    minify: true, splitting: true, define: {'process.env.NODE_ENV': '"production"'}};
const results = [];
for (const arm of ['candidate', 'same-app-without-sdk'] as const)
{
    const result = await Bun.build({...options, ...arm === 'same-app-without-sdk' && {plugins: [{
        name: 'omit-infographic-sdk-only', setup(build) {build.onLoad({filter: /AntvInfographic\.tsx$/}, () =>
            ({contents: 'export const AntvInfographic = () => null;', loader: 'tsx'}));}
    }]}});
    if (!result.success) throw new Error(`Infographic build-size probe failed: ${arm}`);
    const outputs = await Promise.all(result.outputs.filter((output) => output.path.endsWith('.js')).map(async (output) =>
        ({kind: output.kind, bytes: output.size, gzipBytes: Bun.gzipSync(await output.arrayBuffer()).byteLength})));
    results.push({arm, outputs, totalBytes: outputs.reduce((sum, output) => sum + output.bytes, 0),
        totalGzipBytes: outputs.reduce((sum, output) => sum + output.gzipBytes, 0)});
}
console.log(JSON.stringify({runtime: Bun.version, boundary: 'minified split browser JS; each output gzipped independently; no HTTP timing', results}, null, 2));
