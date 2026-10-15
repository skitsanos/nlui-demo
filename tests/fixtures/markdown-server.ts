import homepage from './markdown.html';

const server = Bun.serve({hostname: '127.0.0.1', port: 0, routes: {'/': homepage}, development: {console: true}});
let closing = false;
const close = async () =>
{
    if (closing) return;
    closing = true;
    await server.stop(true);
    process.exit(0);
};
process.on('SIGINT', () => {void close();});
process.on('SIGTERM', () => {void close();});
console.log(`FIXTURE_READY ${server.port}`);
