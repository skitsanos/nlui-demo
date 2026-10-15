import {z} from 'zod';
import type {NluiBlock} from '../types.ts';

export const A2UI_PROTOCOL_VERSION = 'v0.9' as const;
export const A2UI_CATALOG_ID = 'local://nlui/owned-catalog-v1';
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/);
const binding = z.object({path: z.string().regex(/^\/(?:caption|block\d{1,2})$/)}).strict();
const text = z.union([z.string().max(500), binding]);
const component = z.discriminatedUnion('component', [
    z.object({id, component: z.literal('Column'), children: z.array(id).max(20)}).strict(),
    z.object({id, component: z.literal('Text'), text}).strict(),
    ...(['Metric', 'Chart', 'Table', 'Choice', 'Form', 'Notice'] as const).map((name) =>
        z.object({id, component: z.literal(name), blockRef: z.union([id, binding])}).strict()),
    z.object({id, component: z.literal('Button'), label: z.string().min(1).max(80), actionRef: id}).strict()
]);
const data = z.record(z.string().regex(/^(?:caption|block\d{1,2})$/), z.string().max(500));
export const a2uiCommandSchema = z.union([
    z.object({version: z.literal(A2UI_PROTOCOL_VERSION), createSurface: z.object({surfaceId: id, catalogId: z.literal(A2UI_CATALOG_ID)}).strict()}).strict(),
    z.object({version: z.literal(A2UI_PROTOCOL_VERSION), updateComponents: z.object({surfaceId: id, components: z.array(component).max(24)}).strict()}).strict(),
    z.object({version: z.literal(A2UI_PROTOCOL_VERSION), updateDataModel: z.object({surfaceId: id, path: z.literal('/'), value: data}).strict()}).strict(),
    z.object({version: z.literal(A2UI_PROTOCOL_VERSION), deleteSurface: z.object({surfaceId: id}).strict()}).strict()
]);
export type A2uiCommand = z.infer<typeof a2uiCommandSchema>;
export type A2uiComponent = z.infer<typeof component>;
interface Surface {components: Map<string, A2uiComponent>; data: Record<string, string>}
const typeMap = {Metric: 'stats', Chart: 'chart', Table: 'table', Choice: 'choices', Form: 'form', Notice: 'result'} as const;

export class OwnedSurfaceAdapter
{
    readonly surfaces = new Map<string, Surface>();
    private readonly blocks: Map<string, NluiBlock>;
    private readonly actions: Set<string>;
    constructor(blocks: NluiBlock[], actions: string[] = []) {this.blocks = new Map(blocks.map((block) => [block.id, block])); this.actions = new Set(actions);}

    apply(raw: unknown): A2uiCommand
    {
        const command = a2uiCommandSchema.parse(raw);
        if ('createSurface' in command)
        {
            const {surfaceId} = command.createSurface;
            if (this.surfaces.has(surfaceId) || this.surfaces.size >= 4) throw new Error('Surface already exists or limit reached.');
            this.surfaces.set(surfaceId, {components: new Map(), data: {}}); return command;
        }
        if ('deleteSurface' in command) {this.surfaces.delete(command.deleteSurface.surfaceId); return command;}
        const payload = 'updateComponents' in command ? command.updateComponents : command.updateDataModel;
        const previous = this.surfaces.get(payload.surfaceId);
        if (!previous) throw new Error('Create a negotiated surface first.');
        const surface: Surface = {components: new Map(previous.components), data: {...previous.data}};
        if ('components' in payload)
        {
            if (new Set(payload.components.map((entry) => entry.id)).size !== payload.components.length) throw new Error('Duplicate component IDs.');
            for (const entry of payload.components) surface.components.set(entry.id, entry);
        }
        else surface.data = {...payload.value};
        this.validate(surface, false);
        this.surfaces.set(payload.surfaceId, surface); return command;
    }

    complete(surfaceId: string): void
    {
        const surface = this.surfaces.get(surfaceId);
        if (!surface?.components.has('root')) throw new Error('A complete surface requires root.');
        this.validate(surface, true);
    }

    private validate(surface: Surface, complete: boolean): void
    {
        if (surface.components.size > 24) throw new Error('Component limit reached.');
        const parents = new Set<string>();
        for (const entry of surface.components.values()) if (entry.component === 'Column') for (const child of entry.children)
        {
            if (parents.has(child)) throw new Error('A component must have exactly one parent.');
            parents.add(child);
        }
        const visited = new Set<string>();
        const path = new Set<string>();
        const visit = (key: string, depth = 0): void =>
        {
            if (depth > 6 || path.has(key)) throw new Error('Unsafe component graph.');
            const entry = surface.components.get(key);
            if (!entry) {if (complete) throw new Error('Missing child.'); return;}
            path.add(key); visited.add(key);
            if (entry.component === 'Column') for (const child of entry.children) visit(child, depth + 1);
            else if (entry.component === 'Button') {if (!this.actions.has(entry.actionRef)) throw new Error('Unknown opaque action.');}
            else if (entry.component !== 'Text')
            {
                const ref = typeof entry.blockRef === 'string' ? entry.blockRef : surface.data[entry.blockRef.path.slice(1)];
                if (ref === undefined && !complete) {path.delete(key); return;}
                if (!ref || this.blocks.get(ref)?.type !== typeMap[entry.component]) throw new Error('Unissued or mismatched block binding.');
            }
            else if (typeof entry.text !== 'string' && complete && surface.data[entry.text.path.slice(1)] === undefined) throw new Error('Missing text binding.');
            path.delete(key);
        };
        // Even a disconnected malicious/cyclic component is rejected before forwarding.
        for (const key of surface.components.keys()) visit(key);
        if (complete)
        {
            visited.clear(); visit('root');
            if (visited.size !== surface.components.size) throw new Error('Unreachable component.');
        }
    }
}

export const ownedSurfaceCommands = (blocks: NluiBlock[], caption = ''): A2uiCommand[] =>
{
    const supported = blocks.every(({type}) => Object.values(typeMap).includes(type as typeof typeMap[keyof typeof typeMap]));
    if (!supported) throw new Error('The controlled renderer is required for this block.');
    const surfaceId = `surface-${blocks[0]?.id ?? 'empty'}`;
    const components: A2uiComponent[] = [{id: 'root', component: 'Column', children: ['caption', ...blocks.map((_, index) => `item${index}`)]},
        {id: 'caption', component: 'Text', text: {path: '/caption'}},
        ...blocks.map((block, index) => ({id: `item${index}`, component: Object.entries(typeMap).find(([, type]) => type === block.type)![0], blockRef: {path: `/block${index}`}} as A2uiComponent))];
    return [
        {version: A2UI_PROTOCOL_VERSION, createSurface: {surfaceId, catalogId: A2UI_CATALOG_ID}},
        {version: A2UI_PROTOCOL_VERSION, updateComponents: {surfaceId, components}},
        {version: A2UI_PROTOCOL_VERSION, updateDataModel: {surfaceId, path: '/', value: Object.fromEntries([['caption', caption], ...blocks.map((block, index) => [`block${index}`, block.id])])}}
    ];
};

export const qualifySurface = (commands: unknown[], blocks: NluiBlock[], actions: string[] = []): A2uiCommand[] =>
{
    if (commands.length > 32) throw new Error('Surface command limit reached.');
    const adapter = new OwnedSurfaceAdapter(blocks, actions);
    const validated = commands.map((command) => adapter.apply(command));
    if (!adapter.surfaces.size) throw new Error('No renderable surface.');
    for (const id of adapter.surfaces.keys()) adapter.complete(id);
    const references = [...adapter.surfaces.values()].flatMap((surface) => [...surface.components.values()].flatMap((entry) =>
        'blockRef' in entry ? [typeof entry.blockRef === 'string' ? entry.blockRef : surface.data[entry.blockRef.path.slice(1)]!] : []));
    if (references.length !== blocks.length || new Set(references).size !== references.length || blocks.some((block) => !references.includes(block.id)))
        throw new Error('Every issued block must be represented exactly once.');
    return validated;
};
