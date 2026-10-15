import {describe, expect, test} from 'bun:test';
import {DATASET_REFERENCE_DATE, DATASET_SEED} from '../constants.ts';
import {generateCustomers, generateProducts} from './catalog.ts';
import {generateOrders} from './orders.ts';
import {SeededRandom} from './random.ts';
import {alignOrderTimeline, OBSERVED_TIMESTAMP_FIELDS, type OrderTimeline, validateDatasetSnapshot} from './snapshot.ts';
import type {GeneratedDataset} from './types.ts';

const generate = (): GeneratedDataset =>
{
    const random = new SeededRandom(DATASET_SEED);
    const customers = generateCustomers(random);
    const products = generateProducts(random);
    return {customers, products, ...generateOrders(customers, products, random)};
};
const dataset = generate();
const timeline = (orderId: number): OrderTimeline => structuredClone({
    order: dataset.orders.find(({id}) => id === orderId)!,
    payment: dataset.payments.find((row) => row.orderId === orderId)!,
    shipment: dataset.shipments.find((row) => row.orderId === orderId) ?? null,
    returned: dataset.returns.find((row) => row.orderId === orderId) ?? null,
    supportCase: dataset.supportCases.find((row) => row.orderId === orderId) ?? null
});
const datedFields = (value: OrderTimeline): Array<[Record<string, unknown>, string]> =>
    Object.values(value).filter((row) => row !== null).flatMap((row) => Object.keys(row)
        .filter((key) => key.endsWith('At') && typeof (row as Record<string, unknown>)[key] === 'string')
        .map((key): [Record<string, unknown>, string] => [row as Record<string, unknown>, key]));

describe('snapshot-aligned deterministic lifecycles', () =>
{
    test('generates every observed event at or before the exact instant', () =>
    {
        expect(() => validateDatasetSnapshot(dataset)).not.toThrow();
        for (const [table, fields] of Object.entries(OBSERVED_TIMESTAMP_FIELDS))
        {
            const rows = dataset[table as keyof typeof OBSERVED_TIMESTAMP_FIELDS];
            expect(rows.length).toBeGreaterThan(0);
            for (const field of fields)
            {
                const values = rows.map((row) => (row as unknown as Record<string, unknown>)[field]);
                expect(values.every((value) => value === null
                    || (typeof value === 'string' && Number.isFinite(Date.parse(value))
                        && Date.parse(value) <= Date.parse(DATASET_REFERENCE_DATE)))).toBeTrue();
            }
        }
        expect(generate()).toEqual(dataset);
    });

    for (const [table, fields] of Object.entries(OBSERVED_TIMESTAMP_FIELDS))
    {
        for (const field of fields)
        {
            test(`rejects a one-millisecond future ${table}.${field}, even in a non-final row`, () =>
            {
                const changed = structuredClone(dataset);
                const row = changed[table as keyof typeof OBSERVED_TIMESTAMP_FIELDS][0]!;
                (row as unknown as Record<string, unknown>)[field] = '2026-06-30T12:00:00.001Z';
                expect(() => validateDatasetSnapshot(changed)).toThrow('exceeds the dataset snapshot');
            });
        }
    }

    test('accepts the inclusive instant but rejects invalid and missing observed timestamps', () =>
    {
        const changed = structuredClone(dataset);
        changed.orders[0]!.updatedAt = DATASET_REFERENCE_DATE;
        expect(() => validateDatasetSnapshot(changed)).not.toThrow();
        changed.orders[0]!.updatedAt = 'invalid';
        expect(() => validateDatasetSnapshot(changed)).toThrow('Invalid generated fixture timestamp');
        Object.assign(changed.orders[0]!, {updatedAt: null});
        expect(() => validateDatasetSnapshot(changed)).toThrow('is invalid');
        Reflect.deleteProperty(changed.orders[0]!, 'updatedAt');
        expect(() => validateDatasetSnapshot(changed)).toThrow('is invalid');
    });

    test('shifts the complete returned-order lifecycle by one common offset', () =>
    {
        const returned = dataset.returns.find((row) => dataset.supportCases.some((support) => support.orderId === row.orderId))!;
        const value = timeline(returned.orderId);
        const fields = datedFields(value);
        const latest = Math.max(...fields.filter(([, key]) => key !== 'expectedDeliveryAt')
            .map(([row, key]) => Date.parse(row[key] as string)));
        const shift = Date.parse(DATASET_REFERENCE_DATE) + 1 - latest;
        for (const [row, key] of fields) row[key] = new Date(Date.parse(row[key] as string) + shift).toISOString();
        const before = structuredClone(value);
        alignOrderTimeline(value);
        const afterFields = datedFields(value);
        for (const [index, [row, key]] of datedFields(before).entries())
        {
            expect(Date.parse(afterFields[index]![0][key] as string)).toBe(Date.parse(row[key] as string) - 1);
        }
        expect(value.returned!.requestedAt).toBe(DATASET_REFERENCE_DATE);
        expect(value.order.status).toBe(before.order.status);
        expect(value.shipment!.status).toBe(before.shipment!.status);
        expect(value.order.totalCents).toBe(before.order.totalCents);
        const aligned = structuredClone(value);
        alignOrderTimeline(value);
        expect(value).toEqual(aligned);
    });

    test('never shifts solely for forecasts and preserves absent events', () =>
    {
        const value = timeline(1176);
        expect(value.shipment!.expectedDeliveryAt! > DATASET_REFERENCE_DATE).toBeTrue();
        expect(value.shipment!.shippedAt).toBeNull();
        expect(value.shipment!.deliveredAt).toBeNull();
        expect(value.payment.paidAt).toBeNull();
        const before = structuredClone(value);
        alignOrderTimeline(value);
        expect(value).toEqual(before);
        const cancelled = timeline(dataset.orders.find(({status}) => status === 'cancelled')!.id);
        expect(cancelled.shipment).toBeNull();
        expect(() => alignOrderTimeline(cancelled)).not.toThrow();
    });

    test('keeps every aligned event ordered relative to its order and shipment', () =>
    {
        const orders = new Map(dataset.orders.map((order) => [order.id, order]));
        expect(dataset.orders.every((order) => order.createdAt <= order.updatedAt)).toBeTrue();
        expect(dataset.payments.every((payment) => payment.paidAt === null
            || payment.paidAt >= orders.get(payment.orderId)!.createdAt)).toBeTrue();
        expect(dataset.shipments.every((shipment) =>
            (shipment.shippedAt === null || shipment.shippedAt >= orders.get(shipment.orderId)!.createdAt)
            && (shipment.deliveredAt === null || (shipment.shippedAt !== null && shipment.deliveredAt >= shipment.shippedAt))
        )).toBeTrue();
        expect(dataset.returns.every((returned) => returned.requestedAt
            >= dataset.shipments.find((shipment) => shipment.orderId === returned.orderId)!.deliveredAt!)).toBeTrue();
        expect(dataset.supportCases.every((support) => support.createdAt <= support.updatedAt
            && support.createdAt >= orders.get(support.orderId!)!.createdAt)).toBeTrue();
    });
});
