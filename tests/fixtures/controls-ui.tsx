import 'antd/dist/reset.css';
import '../../src/client/styles.css';
import './controls.css';
import {XProvider} from '@ant-design/x';
import {Button, Typography} from 'antd';
import {StrictMode, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {streamChat} from '../../src/client/chat.ts';
import {NluiRenderer} from '../../src/client/components/NluiRenderer.tsx';
import type {FormBlock, StatsBlock} from '../../src/nlui/types.ts';

interface Fixture {forms: FormBlock[]; statistics: StatsBlock[]}
const App = () =>
{
    const [fixture, setFixture] = useState<Fixture>();
    const [counter, setCounter] = useState('No requests yet');
    const responses = useRef(new Map<string, string>());
    useEffect(() => {void fetch('/api/fixture').then((response) => response.json()).then(setFixture);}, []);
    return <XProvider theme={{token: {colorPrimary: '#5b5bd6', borderRadius: 12}}}>
        <main style={{maxWidth: 940, margin: '24px auto', padding: '0 20px'}}>
            <Typography.Title level={1} style={{fontSize: 24}}>Control UX — disposable fixture</Typography.Title>
            <Typography.Paragraph>No live provider or retained database is used. Forms use the real chat route and capability checks.</Typography.Paragraph>
            <Typography.Title level={2} style={{fontSize: 18}}>Record summaries</Typography.Title>
            {fixture && <NluiRenderer blocks={fixture.statistics} conversationId="controls-statistics" onInteraction={async () => true}/>}
            <Typography.Title level={2} style={{fontSize: 18, marginTop: 24}}>Product preference forms</Typography.Title>
            <Typography.Paragraph type="secondary">Clear either optional budget, then submit. Finish pending response holds/releases real in-flight requests for inspection.</Typography.Paragraph>
            <Button onClick={() => void fetch('/api/fixture/release', {method: 'POST'})}>Finish pending response</Button>
            <div className="control-fixture-forms">{fixture?.forms.map((form) =>
            {
                const conversationId = `controls-${form.interactionId}`;
                return <NluiRenderer key={form.id} blocks={[form]} conversationId={conversationId} onInteraction={async (input) =>
                {
                    let completed = false;
                    try
                    {
                        await streamChat({conversationId, input, previousResponseId: responses.current.get(conversationId),
                            signal: new AbortController().signal, onEvent: (event) =>
                            {if (event.type === 'message.completed') responses.current.set(conversationId, event.responseId);}});
                        completed = true;
                    }
                    catch { /* The form keeps its values and exposes an editable retry. */ }
                    setCounter(JSON.stringify(await (await fetch('/api/fixture/state')).json()));
                    return completed;
                }}/>;
            })}</div>
            <output aria-label="Fixture submissions" style={{display: 'block', overflowWrap: 'anywhere', marginTop: 20}}>{counter}</output>
        </main>
    </XProvider>;
};
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
