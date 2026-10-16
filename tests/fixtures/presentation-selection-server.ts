import {runPresentationBenchmark} from '../../src/evals/presentation/benchmark.ts';
import page from './presentation-selection.html';

// Provider-free, process-owned disposable fixture. Benchmark closes and removes its database before serving.
const result = await runPresentationBenchmark();
const server = Bun.serve({hostname: '127.0.0.1', port: 0, routes: {'/': page}, fetch(req)
{
    const path = new URL(req.url).pathname;
    if (path === '/api/fixture/presentations') return Response.json(result);
    if (path === '/favicon.ico') return new Response(null, {status: 204});
    return new Response(null, {status: 404});
}});
let closing = false;
const close = async () => {if (closing) return; closing = true; await server.stop(true); process.exit(0);};
process.on('SIGINT', () => {void close();}); process.on('SIGTERM', () => {void close();});
console.log(`FIXTURE_READY ${server.port}`);
