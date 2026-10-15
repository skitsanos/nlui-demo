import {expect, test} from 'bun:test';

test('Ant Design X deep util imports resolve to the browser-safe ESM build', () =>
{
    const resolved = Bun.resolveSync('@rc-component/util/lib/pickAttrs', import.meta.dir);
    expect(resolved).toEndWith('/@rc-component/util/es/pickAttrs.js');
});

test('Ant Design icon definitions resolve to their ESM build', () =>
{
    const resolved = Bun.resolveSync('@ant-design/icons-svg/lib/asn/ArrowUpOutlined', import.meta.dir);
    expect(resolved).toEndWith('/@ant-design/icons-svg/es/asn/ArrowUpOutlined.js');
});

test('browser entry does not pull filesystem-derived dataset constants into its runtime', async () =>
{
    const result = await Bun.build({entrypoints: [new URL('./main.tsx', import.meta.url).pathname], target: 'browser',
        minify: true, define: {'process.env.NODE_ENV': '"production"'}});
    expect(result.success).toBeTrue();
    const javascript = (await Promise.all(result.outputs.filter((file) => file.type.includes('javascript')).map((file) => file.text()))).join('\n');
    expect(javascript).not.toMatch(/process\.cwd\(/);
    expect(javascript).not.toContain('bun:sqlite');
});
