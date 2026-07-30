export interface IdCrypto
{
    randomUUID?: () => string;
    getRandomValues?: (array: Uint8Array) => Uint8Array;
}

let fallbackSequence = 0;

const uuidFromRandomValues = (source: IdCrypto): string | undefined =>
{
    if (typeof source.getRandomValues !== 'function')
    {
        return undefined;
    }

    const bytes = source.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const fallbackId = (): string =>
{
    fallbackSequence += 1;
    return `${Date.now().toString(36)}-${fallbackSequence.toString(36)}`;
};

/**
 * Generates page-local request and message identifiers.
 *
 * `crypto.randomUUID()` is restricted to secure contexts, so an app opened at
 * `http://0.0.0.0` needs the `getRandomValues()` path even in modern browsers.
 */
export const createClientId = (
    prefix: string,
    source: IdCrypto | undefined = globalThis.crypto
): string =>
{
    const id = typeof source?.randomUUID === 'function'
        ? source.randomUUID()
        : source ? uuidFromRandomValues(source) : undefined;

    return `${prefix}-${id ?? fallbackId()}`;
};
