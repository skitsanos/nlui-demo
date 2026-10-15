import 'antd/dist/reset.css';
import '../../src/client/styles.css';
import {XProvider} from '@ant-design/x';
import {Typography} from 'antd';
import {StrictMode, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Confirmation} from '../../src/client/components/Confirmation.tsx';
import type {ConfirmationBlock} from '../../src/nlui/types.ts';

const App = () =>
{
    const [blocks, setBlocks] = useState<ConfirmationBlock[]>([]);
    const [stats, setStats] = useState('No requests yet');
    useEffect(() => {void fetch('/api/fixture').then((response) => response.json()).then(setBlocks);}, []);
    return <XProvider theme={{token: {colorPrimary: '#5b5bd6', borderRadius: 12}}}>
        <main style={{maxWidth: 800, margin: '32px auto', padding: '0 20px'}}>
            <Typography.Title level={2}>Confirmation recovery — disposable fixture</Typography.Title>
            <Typography.Paragraph>No live provider or retained data is used.</Typography.Paragraph>
            {blocks.map((block) => <section key={block.id} style={{marginBottom: 24}}>
                <Confirmation block={block} conversationId="confirmation-browser-fixture" onInteraction={async (input) =>
                {
                    const response = await fetch('/api/fixture/continue', {method: 'POST', body: JSON.stringify(input)});
                    const payload = await response.json();
                    setStats(JSON.stringify(payload));
                    return payload.completed;
                }}/>
            </section>)}
            <output aria-label="Fixture counters">{stats}</output>
        </main>
    </XProvider>;
};
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
