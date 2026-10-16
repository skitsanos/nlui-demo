import 'antd/dist/reset.css';
import '../../src/client/styles.css';
import {XProvider} from '@ant-design/x';
import {Button, Space, Typography} from 'antd';
import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {NluiRenderer} from '../../src/client/components/NluiRenderer.tsx';
import type {NluiBlock} from '../../src/nlui/types.ts';

const App = () =>
{
    const [blocks, setBlocks] = useState<NluiBlock[]>([]); const [enabled, setEnabled] = useState(true); const [generation, setGeneration] = useState(0);
    useEffect(() => {void fetch('/api/fixture/infographics').then((response) => response.json()).then(setBlocks);}, []);
    return <XProvider theme={{token: {colorPrimary: '#5b5bd6', borderRadius: 12}}}>
        <main style={{maxWidth: 1000, margin: '24px auto', padding: '0 16px'}}>
            <Typography.Title level={1} style={{fontSize: 24}}>NLUI-033 visual explanation qualification</Typography.Title>
            <Typography.Paragraph>Disposable synthetic fixture. Actual production renderer. No provider requests. Figures are candidates, not evidence of improved comprehension.</Typography.Paragraph>
            <Space wrap>
                <Button onClick={() => setEnabled(!enabled)}>{enabled ? 'Use readable views' : 'Show visuals'}</Button>
                <Button onClick={() =>
                {
                    // Deliberately fail actual SDK geometry, only in this disposable browser fixture.
                    SVGGraphicsElement.prototype.getBBox = () => {throw new Error('Fixture geometry failure');};
                    setEnabled(true); setGeneration(generation + 1);
                }}>Simulate renderer failure</Button>
            </Space>
            <NluiRenderer key={generation} blocks={blocks} infographics={enabled} conversationId="fixture-infographics" onInteraction={async () => false}/>
        </main>
    </XProvider>;
};
createRoot(document.getElementById('root')!).render(<App/>);
