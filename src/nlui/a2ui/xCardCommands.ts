import type {XAgentCommand_v0_9} from '@ant-design/x-card';
import type {A2uiCommand} from './adapter.ts';

// X Card 2.9.0 treats the JSON Pointer root '/' as a property named ''.
// Lower our already-qualified root replacement into explicit owned-key writes.
// This is an SDK compatibility adapter, not a broader accepted wire contract.
export const xCardCommands = (commands: A2uiCommand[]) =>
{
    const keys = new Map<string, Set<string>>();
    return commands.flatMap((command): XAgentCommand_v0_9[] =>
    {
        if (!('updateDataModel' in command)) return [command];
        const {surfaceId, value} = command.updateDataModel;
        const removed = [...keys.get(surfaceId) ?? []].filter((key) => !(key in value));
        keys.set(surfaceId, new Set(Object.keys(value)));
        return [...removed.map((key) => [key, null] as const), ...Object.entries(value)].map(([key, item]) => ({
            version: command.version, updateDataModel: {surfaceId, path: `/${key}`, value: item}
        }));
    });
};
