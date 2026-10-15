import {describe, expect, test} from 'bun:test';
import {actionErrorDiagnostic, publicActionError} from './publicActionError.ts';

describe('private action diagnostics', () =>
{
    test('does not log exception text or configured credential/model values embedded in a frame', () =>
    {
        const values = [process.env.OPENAI_API_KEY, process.env.CHAT_MODEL].filter((value): value is string => Boolean(value));
        const error = new Error('provider payload and SQL must not become diagnostics');
        error.stack = `Error: private provider payload\n    at confirm (/app/src/data/actions.ts:42:1)\n`
            + values.map((value) => `    at ${value} (/app/src/data/actions.ts:43:1)`).join('\n');
        const diagnostic = JSON.stringify(actionErrorDiagnostic(error));
        expect(diagnostic.includes('provider payload')).toBeFalse();
        expect(diagnostic.includes('actions.ts')).toBeTrue();
        // Boolean assertions keep actual configured values out of failure output too.
        expect(values.some((value) => diagnostic.includes(value))).toBeFalse();
    });

    test('non-Error exceptions do not become text diagnostics or a public payload', () =>
    {
        expect(actionErrorDiagnostic({message: 'private payload'})).toEqual({kind: 'NonError', location: ''});
        expect(publicActionError({message: 'private payload'})).toMatchObject({status: 500});
    });
});
