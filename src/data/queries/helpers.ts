import type { SQLQueryBindings } from "bun:sqlite";

export type SqlParameter = SQLQueryBindings;

export function startOfDay(value: string): string {
    const date = value.length === 10 ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
    date.setUTCHours(0, 0, 0, 0);
    return date.toISOString();
}

export function endOfDay(value: string): string {
    const date = value.length === 10 ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
    date.setUTCHours(23, 59, 59, 999);
    return date.toISOString();
}

export function normalizedOrderNumber(value: string | number): string {
    const text = String(value).trim().toUpperCase();
    if (/^\d+$/.test(text)) return `ORD-${Number(text)}`;
    if (/^ORD-\d+$/.test(text)) return text;
    throw new Error(`Invalid order number: ${value}`);
}

export function clampInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
    if (value === undefined || !Number.isFinite(value)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}
