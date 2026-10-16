import {Alert, Card, Tag, Typography} from 'antd';
import {Component, lazy, type ReactNode, Suspense, useCallback, useEffect, useRef, useState} from 'react';
import {type InfographicBlock, infographicBlockSchema } from '../../nlui/infographic/schema.ts';
import {formatTemporalValue} from '../dateFormat.ts';
import {infographicValue} from '../infographicOptions.ts';
import {tableScrollPosition} from './DataTable.tsx';

const AntvInfographic = lazy(async () => ({default: (await import('./AntvInfographic.tsx')).AntvInfographic}));
class FigureBoundary extends Component<{children: ReactNode; fallback: ReactNode}, {failed: boolean}>
{
    state = {failed: false};
    static getDerivedStateFromError() {return {failed: true};}
    render() {return this.state.failed ? this.props.fallback : this.props.children;}
}

export const InfographicAlternative = ({block}: {block: InfographicBlock}) => block.view === 'process'
    ? <ol className="infographic-steps">{block.items.map((item) => <li key={item.label}><strong>{item.label}</strong><p>{item.detail}</p></li>)}</ol>
    : <table className="infographic-data"><caption>{block.title}</caption><thead><tr><th scope="col">{block.view === 'comparison' ? 'Region' : 'Recorded event'}</th>
        <th scope="col">{block.view === 'comparison' ? 'Revenue (EUR)' : 'Time (UTC)'}</th></tr></thead>
        <tbody>{block.items.map((item) => <tr key={item.label}><th scope="row">{item.label}</th><td>{item.at
            ? <time dateTime={item.at}>{infographicValue(item)}</time> : infographicValue(item)}</td></tr>)}</tbody></table>;

const Figure = ({block}: {block: InfographicBlock}) =>
{
    const [failed, setFailed] = useState(false); const onFailure = useCallback(() => setFailed(true), []);
    const fallback = <><Alert type="info" title="Using the readable view" description="The visual could not be rendered; the verified content is preserved."/><InfographicAlternative block={block}/></>;
    if (failed) return fallback;
    return <FigureBoundary fallback={fallback}>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: This named visual region can scroll horizontally and needs keyboard access. */}
        <section className="infographic-scroll" tabIndex={0} aria-label={`${block.title} visual; use arrow keys to scroll`}
            onKeyDown={(event) =>
            {
                if (event.target !== event.currentTarget) return;
                const node = event.currentTarget;
                const left = tableScrollPosition(event.key, node.scrollLeft, node.scrollWidth, node.clientWidth);
                if (left !== undefined) {event.preventDefault(); node.scrollTo({left, behavior: 'auto'});}
            }}>
            <Suspense fallback={<span role="status">Loading visual explanation…</span>}><AntvInfographic block={block} onFailure={onFailure}/></Suspense>
        </section>
        <Typography.Text type="secondary" className="infographic-scroll-hint">Scroll within the visual if needed; the exact readable content is available below.</Typography.Text>
        <details className="infographic-alternative"><summary>{block.view === 'process' ? 'Read policy excerpts' : 'View underlying data'}</summary><InfographicAlternative block={block}/></details>
    </FigureBoundary>;
};

export const InfographicCard = ({block: raw, enabled = false}: {block: InfographicBlock; enabled?: boolean}) =>
{
    const content = useRef<HTMLDivElement>(null); const [narrow, setNarrow] = useState(false);
    useEffect(() =>
    {
        if (!enabled || !content.current || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(([entry]) => {if (entry) setNarrow(entry.contentRect.width < 320);});
        observer.observe(content.current); return () => observer.disconnect();
    }, [enabled]);
    const parsed = infographicBlockSchema.safeParse(raw);
    if (!parsed.success) return <Alert type="warning" title="Visual explanation unavailable" description="This content did not match the approved catalog. Ask for a fresh table or policy lookup."/>;
    // Preserve identity across parent renders; remount on issued block identity, not transient annotation/activity updates.
    const block = raw;
    return <Card className="nlui-card infographic-card" title={block.title} extra={<Tag color="purple">Experimental</Tag>}>
        <Typography.Paragraph type="secondary">{block.description}</Typography.Paragraph>
        <div ref={content}>{enabled && !narrow ? <Figure key={block.id} block={block}/> : <InfographicAlternative block={block}/>}</div>
        {enabled && narrow && <Typography.Text type="secondary">Readable view for this narrow space; all verified content is preserved.</Typography.Text>}
        <div className="infographic-provenance"><strong>Scope:</strong> {block.provenance.scope}
            <div><strong>Source:</strong> {block.provenance.source} · Declared dataset snapshot: {formatTemporalValue(block.snapshot)?.text}</div>
            <details><summary>Content fingerprint</summary><code>{block.provenance.fingerprint}</code><p>Identifies this bounded content and scope, not a database revision or independent verification.</p></details>
        </div>
    </Card>;
};
