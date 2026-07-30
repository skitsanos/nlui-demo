import {describe, expect, test} from 'bun:test';
import {createClientId, type IdCrypto} from './id.ts';

describe('createClientId', () =>
{
    test('uses native randomUUID when it is available', () =>
    {
        let getRandomValuesCalled = false;
        const source: IdCrypto = {
            randomUUID: () => 'native-uuid',
            getRandomValues: (bytes) =>
            {
                getRandomValuesCalled = true;
                return bytes;
            }
        };

        expect(createClientId('request', source)).toBe('request-native-uuid');
        expect(getRandomValuesCalled).toBeFalse();
    });

    test('builds a UUID v4 from getRandomValues on insecure origins', () =>
    {
        const source: IdCrypto = {
            getRandomValues: (bytes) =>
            {
                bytes.forEach((_, index) =>
                {
                    bytes[index] = index;
                });
                return bytes;
            }
        };

        expect(createClientId('assistant', source))
            .toBe('assistant-00010203-0405-4607-8809-0a0b0c0d0e0f');
    });

    test('keeps IDs distinct when Web Crypto is unavailable', () =>
    {
        const first = createClientId('user', {});
        const second = createClientId('user', {});

        expect(first).toStartWith('user-');
        expect(second).toStartWith('user-');
        expect(first).not.toBe(second);
    });
});
