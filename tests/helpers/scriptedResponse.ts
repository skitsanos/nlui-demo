import type {ResponseStreamEvent} from 'openai/resources/responses/responses';

export interface ScriptedCall {name: string; args: unknown; callId?: string}
// Synthetic completed provider envelopes, never an API client or model-quality observation.
export const scriptedResponse = (id: string, calls: ScriptedCall[] = [], final?: unknown): AsyncIterable<ResponseStreamEvent> =>
    (async function* ()
    {
        const output = calls.map((call, index) => ({type: 'function_call', id: `${id}-item-${index}`, status: 'completed',
            call_id: call.callId ?? `${id}-call-${index}`, name: call.name, arguments: JSON.stringify(call.args)}));
        yield {type: 'response.created', response: {id, model: 'injected-fixture'}} as ResponseStreamEvent;
        for (const item of output) yield {type: 'response.output_item.done', item} as ResponseStreamEvent;
        if (final) yield {type: 'response.output_text.delta', delta: JSON.stringify(final)} as ResponseStreamEvent;
        yield {type: 'response.completed', response: {id, model: 'injected-fixture', status: 'completed', output, usage: null}} as unknown as ResponseStreamEvent;
    })();
