export class SeededRandom {
    private state: number;

    constructor(seed: number) {
        this.state = seed >>> 0;
    }

    next(): number {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let value = this.state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    }

    integer(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    pick<T>(values: readonly T[]): T {
        const selected = values[this.integer(0, values.length - 1)];
        if (selected === undefined) {
            throw new Error("Cannot pick from an empty collection");
        }
        return selected;
    }

    weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
        const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
        let cursor = this.next() * total;
        for (const [value, weight] of entries) {
            cursor -= weight;
            if (cursor <= 0) return value;
        }
        const fallback = entries.at(-1)?.[0];
        if (fallback === undefined) throw new Error("Cannot select from empty weights");
        return fallback;
    }

    shuffle<T>(values: readonly T[]): T[] {
        const copy = [...values];
        for (let index = copy.length - 1; index > 0; index -= 1) {
            const swapIndex = this.integer(0, index);
            [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
        }
        return copy;
    }
}

export function addDays(timestamp: string, days: number): string {
    const date = new Date(timestamp);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString();
}

export function addHours(timestamp: string, hours: number): string {
    const date = new Date(timestamp);
    date.setUTCHours(date.getUTCHours() + hours);
    return date.toISOString();
}
