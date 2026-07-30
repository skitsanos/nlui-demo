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
