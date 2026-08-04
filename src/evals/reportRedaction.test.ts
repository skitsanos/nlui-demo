import {describe, expect, test} from 'bun:test';
import {redactConfiguredText, redactConfiguredValues} from './reportRedaction.ts';

describe('evaluation report redaction', () =>
{
    test('removes configured model values from nested report metadata and traces', () =>
    {
        expect(redactConfiguredValues({
            metadata: {models: ['configured-a', 'configured-a', 'configured-b']},
            reports: [{
                trace: {model: 'configured-a'},
                error: 'Model configured-a rejected test-api-token',
                result: {value: 200}
            }]
        }, {model: 'configured-a', apiKey: 'test-api-token'})).toEqual({
            metadata: {modelConfigurationCount: 2},
            reports: [{
                trace: {model: '[configured]'},
                error: 'Model [configured] rejected [redacted]',
                result: {value: 200}
            }]
        });
        expect(redactConfiguredText(
            'configured-a rejected test-api-token',
            {model: 'configured-a', apiKey: 'test-api-token'}
        )).toBe('[configured] rejected [redacted]');
    });
});
