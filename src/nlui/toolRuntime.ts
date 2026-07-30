import {createDemoRepository, type DemoRepository, ensureDemoDatabase} from '../data/index.ts';

let repository: DemoRepository | undefined;

export const getRepository = (): DemoRepository =>
{
    if (!repository)
    {
        ensureDemoDatabase();
        repository = createDemoRepository();
    }
    return repository;
};

export const euros = (cents: number): number => Number((cents / 100).toFixed(2));

export const percentTrend = (value: number | null): 'up' | 'down' | 'flat' =>
    value === null || value === 0 ? 'flat' : value > 0 ? 'up' : 'down';

export const normalizeOrderNumber = (value: string): string =>
{
    const match = value.trim().toUpperCase().match(/^(?:ORD-)?0*(\d+)$/);
    return match ? `ORD-${Number(match[1])}` : value;
};
