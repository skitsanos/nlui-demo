import {DATASET_REFERENCE_DATE} from '../constants.ts';
import type {GeneratedDataset, OrderSeed, PaymentSeed, ReturnSeed, ShipmentSeed, SupportCaseSeed} from './types.ts';

export const OBSERVED_TIMESTAMP_FIELDS = {
    customers: ['joinedAt'],
    orders: ['createdAt', 'updatedAt'],
    payments: ['paidAt'],
    shipments: ['shippedAt', 'deliveredAt'],
    returns: ['requestedAt'],
    supportCases: ['createdAt', 'updatedAt']
} as const;

export interface OrderTimeline
{
    order: OrderSeed;
    payment: PaymentSeed;
    shipment: ShipmentSeed | null;
    returned: ReturnSeed | null;
    supportCase: SupportCaseSeed | null;
}

const snapshotTime = Date.parse(DATASET_REFERENCE_DATE);
const timestamp = (value: string): number =>
{
    const time = Date.parse(value);
    if (!Number.isFinite(time)) throw new Error('Invalid generated fixture timestamp');
    return time;
};

// Move an entire lifecycle, never individual events: keep elapsed durations and
// status/null semantics intact. Forecasts move with their order but do not set
// the observed-data boundary and may still extend beyond it.
export const alignOrderTimeline = (timeline: OrderTimeline): void =>
{
    const {order, payment, shipment, returned, supportCase} = timeline;
    const observed = [order.createdAt, order.updatedAt, payment.paidAt,
        shipment?.shippedAt, shipment?.deliveredAt, returned?.requestedAt,
        supportCase?.createdAt, supportCase?.updatedAt];
    const latest = Math.max(...observed.filter((value): value is string => value != null).map(timestamp));
    const shift = Math.max(0, latest - snapshotTime);
    if (shift === 0) return;
    const move = (value: string): string => new Date(timestamp(value) - shift).toISOString();
    order.createdAt = move(order.createdAt);
    order.updatedAt = move(order.updatedAt);
    if (payment.paidAt !== null) payment.paidAt = move(payment.paidAt);
    if (shipment)
    {
        if (shipment.shippedAt !== null) shipment.shippedAt = move(shipment.shippedAt);
        if (shipment.deliveredAt !== null) shipment.deliveredAt = move(shipment.deliveredAt);
        if (shipment.expectedDeliveryAt !== null) shipment.expectedDeliveryAt = move(shipment.expectedDeliveryAt);
    }
    if (returned) returned.requestedAt = move(returned.requestedAt);
    if (supportCase)
    {
        supportCase.createdAt = move(supportCase.createdAt);
        supportCase.updatedAt = move(supportCase.updatedAt);
    }
};

export const validateDatasetSnapshot = (dataset: GeneratedDataset): void =>
{
    for (const [table, fields] of Object.entries(OBSERVED_TIMESTAMP_FIELDS))
    {
        const rows = dataset[table as keyof typeof OBSERVED_TIMESTAMP_FIELDS];
        for (const row of rows)
        {
            for (const field of fields)
            {
                const value = (row as unknown as Record<string, unknown>)[field];
                if (value === null && (table === 'payments' || table === 'shipments')) continue;
                if (typeof value !== 'string' || timestamp(value) > snapshotTime)
                {
                    throw new Error(`Generated ${table}.${field} exceeds the dataset snapshot or is invalid`);
                }
            }
        }
    }
};
