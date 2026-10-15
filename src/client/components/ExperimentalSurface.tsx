import {registerCatalog, XCard } from '@ant-design/x-card';
import {Alert, Button, Space, Typography} from 'antd';
import {createContext, type ReactNode, useContext, useMemo} from 'react';
import {A2UI_CATALOG_ID, ownedSurfaceCommands, qualifySurface} from '../../nlui/a2ui/adapter.ts';
import {xCardCommands} from '../../nlui/a2ui/xCardCommands.ts';
import type {ChatInput, NluiBlock} from '../../nlui/types.ts';
import type {ControlState} from '../conversationReplay.ts';
import type {AnalysisSubmission} from './AnalysisControls.tsx';
import {NluiRenderer} from './NluiRenderer.tsx';

registerCatalog({$id: A2UI_CATALOG_ID, catalogId: A2UI_CATALOG_ID, components: Object.fromEntries(
    ['Column', 'Text', 'Metric', 'Chart', 'Table', 'Choice', 'Form', 'Notice', 'Button'].map((name) => [name, {type: 'object'}]))});

interface Props {blocks: NluiBlock[]; conversationId: string; disabled?: boolean; states?: Record<string, ControlState>;
    onInteraction: (input: ChatInput, displayText: string) => Promise<boolean>; onAnalyze?: (input: AnalysisSubmission) => Promise<boolean>;
    commands?: unknown[]; actions?: Record<string, {input: ChatInput; label: string}>}

const EMPTY_ACTIONS: NonNullable<Props['actions']> = {};
const SurfaceContext = createContext<Props | null>(null);
const BoundBlock = ({blockRef}: {blockRef?: string}) =>
{
    const props = useContext(SurfaceContext);
    const block = props?.blocks.find(({id}) => id === blockRef);
    return block && props ? <NluiRenderer {...props} blocks={[block]}/> : <Typography.Text type="secondary">Waiting for validated data…</Typography.Text>;
};
const BoundButton = ({label, actionRef}: {label: string; actionRef: string}) =>
{
    const props = useContext(SurfaceContext); const action = props?.actions?.[actionRef];
    return <Button disabled={props?.disabled || !action} onClick={() => {if (props && action && !props.disabled) void props.onInteraction(action.input, action.label);}}>{label}</Button>;
};
const COMPONENTS = {
    Column: ({children}: {children?: ReactNode}) => <Space orientation="vertical" className="nlui-stack">{children}</Space>,
    Text: ({text}: {text?: string}) => text ? <Typography.Paragraph>{text}</Typography.Paragraph> : null,
    Metric: BoundBlock, Chart: BoundBlock, Table: BoundBlock, Choice: BoundBlock, Form: BoundBlock, Notice: BoundBlock, Button: BoundButton
};

export const ExperimentalSurface = ({commands: requested, actions = EMPTY_ACTIONS, ...props}: Props) =>
{
    const selection = useMemo(() =>
    {
        try {return {commands: qualifySurface(requested ?? ownedSurfaceCommands(props.blocks), props.blocks, Object.keys(actions))};}
        catch {return {commands: undefined};}
    }, [requested, props.blocks, actions]);
    const sdkCommands = useMemo(() => selection.commands ? xCardCommands(selection.commands) : [], [selection.commands]);
    if (!selection.commands) return <>
        <Alert type="info" title="Using the controlled view" description="This surface is unsupported or invalid; no generated action was executed."/>
        <NluiRenderer {...props}/>
    </>;
    const surfaces = selection.commands.flatMap((command) => 'createSurface' in command ? [command.createSurface.surfaceId] : []);
    return <section aria-label="Experimental A2UI v0.9 surface" data-renderer="x-card-2.9.0">
        <SurfaceContext.Provider value={{...props, actions}}><XCard.Box components={COMPONENTS} commands={sdkCommands}>
            {surfaces.map((id) => <XCard.Card key={id} id={id}/>)}</XCard.Box></SurfaceContext.Provider>
    </section>;
};
