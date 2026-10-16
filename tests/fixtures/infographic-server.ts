import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDemoRepository} from '../../src/data/index.ts';
import {infographicsEnabled} from '../../src/nlui/infographic/catalog.ts';
import {toolsForQueryArm} from '../../src/nlui/toolDefinitions.ts';
import {executeNluiTool} from '../../src/nlui/tools.ts';
import page from './infographic.html';

const root = await mkdtemp(join(tmpdir(), 'nlui-infographic-http-'));
const databasePath = join(root, 'demo.sqlite'); const repository = createDemoRepository({databasePath});
const args = [
    {view: 'comparison', regions: ['West', 'East'], from: '2026-01-01', to: '2026-06-30', order_number: null},
    {view: 'timeline', regions: [], from: null, to: null, order_number: 'ORD-1042'},
    {view: 'process', regions: [], from: null, to: null, order_number: null}
];
const server = Bun.serve({hostname: '127.0.0.1', port: 0, routes: {'/': page}, async fetch(req)
{
    const enabled = infographicsEnabled();
    const path = new URL(req.url).pathname;
    if (path === '/api/fixture/infographics' || path === '/api/fixture/qualification')
    {
        const results = await Promise.all(args.map((args) => executeNluiTool('get_infographic', JSON.stringify(args), undefined, {databasePath, repository})));
        const blocks = results.flatMap(({blocks}) => blocks);
        return Response.json(path === '/api/fixture/infographics' ? blocks : {enabled,
            tools: toolsForQueryArm('control', enabled).map(({name}) => name), blocks,
            rejected: results.filter(({blocks}) => !blocks.length).length});
    }
    return new Response(null, {status: 404});
}});
let closing = false;
const close = async () => {if (closing) return; closing = true; await server.stop(true); repository.close(); await rm(root, {recursive: true, force: true}); process.exit(0);};
process.on('SIGINT', () => {void close();}); process.on('SIGTERM', () => {void close();});
console.log(`FIXTURE_READY ${server.port}`);
