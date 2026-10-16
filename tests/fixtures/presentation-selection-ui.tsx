import 'antd/dist/reset.css';
import '../../src/client/styles.css';
import './presentation-selection.css';
import {XProvider} from '@ant-design/x';
import {Alert, Button, Radio, Select, Space, Typography} from 'antd';
import {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {NluiRenderer} from '../../src/client/components/NluiRenderer.tsx';
import type {MatchedPresentation} from '../../src/evals/presentation/benchmark.ts';
import type {PresentationSelection} from '../../src/evals/presentation/selection.ts';

interface Sample {caseId: string; arm: string; mountToReadyMs: number; mode: string; width: number; overflow: boolean}
const MeasuredView = ({selection, caseId, arm, visuals, onMeasured}: {selection: PresentationSelection; caseId: string; arm: string;
    visuals: boolean; onMeasured: (sample: Sample) => void}) =>
{
    const content = useRef<HTMLDivElement>(null);
    const report = useRef(onMeasured); report.current = onMeasured;
    useEffect(() =>
    {
        const begin = performance.now(); const root = content.current!; let active = true; let frame = 0;
        const check = () =>
        {
            if (!active) return;
            const expectedFigure = visuals && selection.representation.startsWith('infographic:');
            const figure = root.querySelector('[data-ready="true"]');
            const readable = root.querySelector('.infographic-data, .infographic-steps');
            const fallback = root.querySelector('.ant-alert');
            if (expectedFigure && !figure && (!readable || root.querySelector('.infographic-scroll') && !fallback))
            {frame = requestAnimationFrame(check); return;}
            frame = requestAnimationFrame(() =>
            {
                if (!active) return;
                report.current({caseId, arm, mountToReadyMs: Math.round((performance.now() - begin) * 100) / 100,
                    mode: figure ? 'figure' : expectedFigure ? 'readable-fallback' : 'controlled-or-readable',
                    width: root.clientWidth, overflow: document.documentElement.scrollWidth > window.innerWidth});
            });
        };
        frame = requestAnimationFrame(check);
        return () => {active = false; cancelAnimationFrame(frame);};
    }, [selection, caseId, arm, visuals]);
    return <div ref={content} className="presentation-content">
        <Typography.Paragraph className="presentation-caption">{selection.caption}</Typography.Paragraph>
        <NluiRenderer blocks={selection.blocks} infographics={visuals} conversationId="presentation-fixture" onInteraction={async () => false}/>
        <p className="presentation-scope"><strong>Matched scope:</strong> {selection.context.scope} <br/>
            Source: {selection.context.source} · Unit: {selection.context.unit} · Snapshot: {selection.context.snapshot}</p>
    </div>;
};
const App = () =>
{
    const [pairs, setPairs] = useState<MatchedPresentation[]>([]); const [caseId, setCaseId] = useState('regional-comparison');
    const [arm, setArm] = useState<'baseline' | 'candidate'>('baseline'); const [visuals, setVisuals] = useState(true);
    const [generation, setGeneration] = useState(0); const [samples, setSamples] = useState<Sample[]>([]); const [failed, setFailed] = useState(false);
    useEffect(() => {void fetch('/api/fixture/presentations').then((r) => {if (!r.ok) throw new Error(); return r.json();})
        .then(({pairs}) => setPairs(pairs)).catch(() => setFailed(true));}, []);
    const pair = pairs.find(({task}) => task.id === caseId);
    return <XProvider theme={{token: {colorPrimary: '#5b5bd6', borderRadius: 12}}}>
        <main className="presentation-lab">
            <Typography.Title level={1}>Presentation selection lab</Typography.Title>
            <Typography.Paragraph>NLUI-034 · Matched synthetic content, production renderers, authored choices. No model requests or participant results. Eligibility is not observed model accuracy.</Typography.Paragraph>
            {failed && <Alert type="error" title="Fixture unavailable"/>}
            <div className="presentation-controls">
                <label htmlFor="presentation-case">Task</label><Select id="presentation-case" value={caseId} onChange={setCaseId}
                    options={pairs.map(({task}) => ({value: task.id, label: task.id}))}/>
                <Radio.Group aria-label="Presentation arm" value={arm} onChange={(e) => setArm(e.target.value)} optionType="button"
                    options={[{value: 'baseline', label: 'Existing renderer'}, {value: 'candidate', label: 'Candidate policy'}]}/>
                <Space wrap><Button onClick={() => setVisuals(!visuals)}>{visuals ? 'Use readable alternative' : 'Enable figures'}</Button>
                    <Button onClick={() => setGeneration(generation + 1)}>Repeat mount</Button></Space>
            </div>
            {pair && <><h2>{pair.task.prompt}</h2><p><strong>Task fit:</strong> {pair.task.reason}</p>
                <p role="status">Selected: {pair[arm].representation} · {pair.task.baseline === pair.task.candidate ? 'No infographic admitted' : 'An infographic is eligible, not proven better'}</p>
                <MeasuredView key={`${caseId}-${arm}-${visuals}-${generation}`} selection={pair[arm]} caseId={caseId} arm={arm} visuals={visuals}
                    onMeasured={(sample) => setSamples((previous) => [...previous, sample])}/></>}
            <details className="presentation-measurements"><summary>Local mount measurements ({samples.length})</summary>
                <p>Effect start to qualified figure/readable DOM and one animation frame. Warm/cold cache is uncontrolled. Not network, model, user task time or comprehension. Both arms share the same app bundle.</p>
                <pre>{JSON.stringify(samples, null, 2)}</pre></details>
        </main>
    </XProvider>;
};
createRoot(document.getElementById('root')!).render(<App/>);
