import 'antd/dist/reset.css';
import '../../src/client/styles.css';
import {XProvider} from '@ant-design/x';
import {Alert, Tabs, Typography} from 'antd';
import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {streamChat} from '../../src/client/chat.ts';
import {NluiRenderer} from '../../src/client/components/NluiRenderer.tsx';
import type {NluiBlock} from '../../src/nlui/types.ts';

interface Example {id: string; prompt: string; caption: string; conversationId: string; blocks: NluiBlock[]}
const App = () =>
{
    const [examples, setExamples] = useState<Example[]>([]);
    const [receipt, setReceipt] = useState('');
    useEffect(() => {void fetch('/api/fixture').then((response) => response.json()).then(setExamples);}, []);
    return <XProvider theme={{token: {colorPrimary: '#5b5bd6', borderRadius: 12}}}>
        <main style={{maxWidth: 1100, margin: '24px auto', padding: '0 20px'}}>
            <Typography.Title level={1} style={{fontSize: 24}}>NLUI-031 presentation qualification</Typography.Title>
            <Typography.Paragraph>Disposable synthetic data. Production renderer and typed interactions. No live provider.</Typography.Paragraph>
            <Tabs items={examples.map((example) => ({key: example.id, label: example.id.replace('products-', ''), children: <>
                <Typography.Title level={2} style={{fontSize: 20}}>{example.prompt}</Typography.Title>
                <Typography.Paragraph>{example.caption}</Typography.Paragraph>
                <NluiRenderer blocks={example.blocks} conversationId={example.conversationId} onInteraction={async (input) =>
                {
                    let completed = false;
                    await streamChat({conversationId: example.conversationId, input, signal: new AbortController().signal,
                        onEvent: (event) =>
                        {
                            if (event.type === 'text.delta') setReceipt(event.delta);
                            if (event.type === 'message.completed') completed = true;
                        }});
                    return completed;
                }}/>
            </>}))}/>
            {receipt && <Alert type="success" title={receipt} style={{marginTop: 16}}/>}
        </main>
    </XProvider>;
};
createRoot(document.getElementById('root')!).render(<App/>);
