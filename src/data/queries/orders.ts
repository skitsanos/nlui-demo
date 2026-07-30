import type { Database } from "bun:sqlite";
import type {
    OrderDetails,
    OrderFilters,
    OrderLineItem,
    OrderSummary,
    Page,
} from "../types.ts";
import { clampInteger, endOfDay, normalizedOrderNumber, type SqlParameter, startOfDay } from "./helpers.ts";

function orderWhere(filters: OrderFilters): { clause: string; parameters: SqlParameter[] } {
    const clauses: string[] = [];
    const parameters: SqlParameter[] = [];
    if (filters.search?.trim()) {
        const search = `%${filters.search.trim()}%`;
        clauses.push(
            "(o.order_number LIKE ? COLLATE NOCASE OR c.first_name || ' ' || c.last_name LIKE ? COLLATE NOCASE OR c.email LIKE ? COLLATE NOCASE)",
        );
        parameters.push(search, search, search);
    }
    if (filters.statuses?.length) {
        const statuses = [...new Set(filters.statuses)];
        clauses.push(`o.status IN (${statuses.map(() => "?").join(", ")})`);
        parameters.push(...statuses);
    }
    if (filters.region) {
        clauses.push("o.region = ?");
        parameters.push(filters.region);
    }
    if (filters.minTotalCents !== undefined) {
        clauses.push("o.total_cents >= ?");
        parameters.push(Math.max(0, Math.trunc(filters.minTotalCents)));
    }
    if (filters.maxTotalCents !== undefined) {
        clauses.push("o.total_cents <= ?");
        parameters.push(Math.max(0, Math.trunc(filters.maxTotalCents)));
    }
    if (filters.from) {
        clauses.push("o.created_at >= ?");
        parameters.push(startOfDay(filters.from));
    }
    if (filters.to) {
        clauses.push("o.created_at <= ?");
        parameters.push(endOfDay(filters.to));
    }
    if (filters.customerId !== undefined) {
        clauses.push("o.customer_id = ?");
        parameters.push(Math.trunc(filters.customerId));
    }
    return { clause: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", parameters };
}

const ORDER_SELECT = `
    SELECT o.order_number AS orderNumber, o.customer_id AS customerId,
           c.first_name || ' ' || c.last_name AS customerName, o.region, o.status,
           SUM(oi.quantity) AS itemCount, o.total_cents AS totalCents, o.currency,
           o.created_at AS createdAt, s.expected_delivery_at AS expectedDeliveryAt
    FROM orders o JOIN customers c ON c.id = o.customer_id
    JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN shipments s ON s.order_id = o.id
`;

const SORT_SQL: Record<NonNullable<OrderFilters["sort"]>, string> = {
    created_asc: "o.created_at ASC",
    created_desc: "o.created_at DESC",
    total_asc: "o.total_cents ASC",
    total_desc: "o.total_cents DESC",
};

export function queryOrders(database: Database, filters: OrderFilters = {}): Page<OrderSummary> {
    const where = orderWhere(filters);
    const limit = clampInteger(filters.limit, 25, 1, 100);
    const offset = clampInteger(filters.offset, 0, 0, 100_000);
    const sort = SORT_SQL[filters.sort ?? "created_desc"];
    const total =
        database
            .query<{ count: number }, SqlParameter[]>(
                `SELECT COUNT(*) AS count FROM orders o JOIN customers c ON c.id = o.customer_id ${where.clause}`,
            )
            .get(...where.parameters)?.count ?? 0;
    const items = database
        .query<OrderSummary, SqlParameter[]>(
            `${ORDER_SELECT} ${where.clause} GROUP BY o.id ORDER BY ${sort} LIMIT ? OFFSET ?`,
        )
        .all(...where.parameters, limit, offset);
    return { items, limit, offset, total };
}

interface OrderBaseRow extends OrderSummary {
    customerEmail: string;
    shippingLine1: string;
    shippingCity: string;
    shippingPostalCode: string;
    shippingCountry: string;
    subtotalCents: number;
    discountCents: number;
    shippingCents: number;
    taxCents: number;
}

export function queryOrder(database: Database, orderNumber: string | number): OrderDetails | null {
    const normalized = normalizedOrderNumber(orderNumber);
    const base = database
        .query<OrderBaseRow, [string]>(
            `SELECT o.order_number AS orderNumber, o.customer_id AS customerId,
                    c.first_name || ' ' || c.last_name AS customerName, o.region, o.status,
                    SUM(oi.quantity) AS itemCount, o.total_cents AS totalCents, o.currency,
                    o.created_at AS createdAt, s.expected_delivery_at AS expectedDeliveryAt,
                    c.email AS customerEmail, o.shipping_line1 AS shippingLine1,
                    o.shipping_city AS shippingCity, o.shipping_postal_code AS shippingPostalCode,
                    o.shipping_country AS shippingCountry, o.subtotal_cents AS subtotalCents,
                    o.discount_cents AS discountCents, o.shipping_cents AS shippingCents, o.tax_cents AS taxCents
             FROM orders o JOIN customers c ON c.id = o.customer_id
             JOIN order_items oi ON oi.order_id = o.id LEFT JOIN shipments s ON s.order_id = o.id
             WHERE o.order_number = ? GROUP BY o.id`,
        )
        .get(normalized);
    if (!base) return null;

    const items = database
        .query<OrderLineItem, [string]>(
            `SELECT p.sku, p.name AS productName, p.category, oi.quantity,
                    oi.unit_price_cents AS unitPriceCents, oi.line_total_cents AS lineTotalCents
             FROM order_items oi JOIN products p ON p.id = oi.product_id
             JOIN orders o ON o.id = oi.order_id WHERE o.order_number = ? ORDER BY oi.id`,
        )
        .all(normalized);
    const payment = database
        .query<{ method: string; status: string; paidAt: string | null }, [string]>(
            `SELECT p.method, p.status, p.paid_at AS paidAt FROM payments p
             JOIN orders o ON o.id = p.order_id WHERE o.order_number = ?`,
        )
        .get(normalized);
    const shipment = database
        .query<
            {
                carrier: string;
                trackingNumber: string;
                status: string;
                shippedAt: string | null;
                expectedDeliveryAt: string | null;
                deliveredAt: string | null;
            },
            [string]
        >(
            `SELECT s.carrier, s.tracking_number AS trackingNumber, s.status, s.shipped_at AS shippedAt,
                    s.expected_delivery_at AS expectedDeliveryAt, s.delivered_at AS deliveredAt
             FROM shipments s JOIN orders o ON o.id = s.order_id WHERE o.order_number = ?`,
        )
        .get(normalized);
    const returns = database
        .query<
            { returnNumber: string; status: string; reason: string; requestedAt: string; refundCents: number },
            [string]
        >(
            `SELECT r.return_number AS returnNumber, r.status, r.reason, r.requested_at AS requestedAt,
                    r.refund_cents AS refundCents FROM returns r JOIN orders o ON o.id = r.order_id
             WHERE o.order_number = ? ORDER BY r.requested_at DESC`,
        )
        .all(normalized);

    const {
        shippingLine1,
        shippingCity,
        shippingPostalCode,
        shippingCountry,
        ...order
    } = base;
    return {
        ...order,
        shippingAddress: {
            line1: shippingLine1,
            city: shippingCity,
            postalCode: shippingPostalCode,
            country: shippingCountry,
        },
        items,
        payment: payment ?? null,
        shipment: shipment ?? null,
        returns,
    };
}
