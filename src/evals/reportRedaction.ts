const uniqueStrings = (values: unknown[]): string[] => [...new Set(
    values.filter((value): value is string => typeof value === 'string')
)];

export interface EvaluationRedactionConfig
{
    apiKey?: string;
    model?: string;
}

const environmentConfig = (): EvaluationRedactionConfig => ({
    apiKey: process.env.OPENAI_API_KEY?.trim(),
    model: process.env.CHAT_MODEL?.trim()
});

const redactText = (value: string, config: EvaluationRedactionConfig): string =>
{
    let redacted = value;
    for (const [secret, replacement] of [
        [config.apiKey, '[redacted]'],
        [config.model, '[configured]']
    ] as const)
    {
        if (secret) redacted = redacted.split(secret).join(replacement);
    }
    return redacted;
};

const redactValues = (value: unknown, config: EvaluationRedactionConfig): unknown =>
{
    if (typeof value === 'string') return redactText(value, config);
    if (Array.isArray(value)) return value.map((entry) => redactValues(entry, config));
    if (typeof value !== 'object' || value === null) return value;
    return Object.fromEntries(Object.entries(value).map(([key, entry]) =>
    {
        if (key === 'model' && typeof entry === 'string') return [key, '[configured]'];
        if (key === 'models' && Array.isArray(entry))
        {
            return ['modelConfigurationCount', uniqueStrings(entry).length];
        }
        return [key, redactValues(entry, config)];
    }));
};

export const redactConfiguredValues = (
    value: unknown,
    config = environmentConfig()
): unknown => redactValues(value, config);

export const redactConfiguredText = (
    value: string,
    config = environmentConfig()
): string => redactText(value, config);
