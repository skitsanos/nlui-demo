import type { Database } from "bun:sqlite";
import { DATASET_REFERENCE_DATE } from "./constants.ts";
import { normalizedOrderNumber } from "./queries/helpers.ts";
import type {
    ActionConfirmation,
    DemoActionInput,
    DemoActionResult,
    ShippingAddress,
} from "./types.ts";

interface ActionOrderRow {
    id: number;
    orderNumber: string;
    status: string;
    totalCents: number;
    shippingCents: number;
    deliveredAt: string | null;
    returnCount: number;
}

interface PendingActionRow {
    actionId: string;
    actionType: DemoActionInput["type"];
    orderId: number;
    orderNumber: string;
    payloadJson: string;
    status: string;
    expiresAt: string;
}

function cleanText(value: string, label: string, maximum: number): string {
    const cleaned = value.trim();
    if (cleaned.length < 3 || cleaned.length > maximum) {
        throw new Error(`${label} must contain between 3 and ${maximum} characters`);
    }
    return cleaned;
}

function cleanAddress(address: ShippingAddress): ShippingAddress {
    return {
        line1: cleanText(address.line1, "Address line", 120),
        city: cleanText(address.city, "City", 80),
        postalCode: cleanText(address.postalCode, "Postal code", 24),
        country: cleanText(address.country, "Country", 80),
    };
}

function orderForAction(database: Database, orderNumber: string): ActionOrderRow {
    const order = database
        .query<ActionOrderRow, [string]>(
            `SELECT o.id, o.order_number AS orderNumber, o.status, o.total_cents AS totalCents,
                    o.shipping_cents AS shippingCents, s.delivered_at AS deliveredAt,
                    COUNT(r.id) AS returnCount
             FROM orders o LEFT JOIN shipments s ON s.order_id = o.id
             LEFT JOIN returns r ON r.order_id = o.id WHERE o.order_number = ? GROUP BY o.id`,
        )
        .get(orderNumber);
    if (!order) throw new Error(`Order ${orderNumber} was not found`);
    return order;
}

function validateReturn(order: ActionOrderRow, reason: string): DemoActionInput {
    if (order.status !== "delivered") throw new Error(`Order ${order.orderNumber} is not eligible for a return`);
    if (order.returnCount > 0) throw new Error(`Order ${order.orderNumber} already has a return`);
    if (!order.deliveredAt) throw new Error(`Order ${order.orderNumber} has no recorded delivery date`);
    const elapsedDays =
        (new Date(DATASET_REFERENCE_DATE).getTime() - new Date(order.deliveredAt).getTime()) / (24 * 60 * 60 * 1_000);
    if (elapsedDays < 0 || elapsedDays > 30) throw new Error(`Order ${order.orderNumber} is outside the 30-day return window`);
    return { type: "return_order", orderNumber: order.orderNumber, reason: cleanText(reason, "Return reason", 300) };
}

function validateAction(order: ActionOrderRow, input: DemoActionInput): DemoActionInput {
    switch (input.type) {
        case "return_order":
            return validateReturn(order, input.reason);
        case "update_shipping_address":
            if (order.status !== "processing") {
                throw new Error(`The shipping address for ${order.orderNumber} can no longer be changed`);
            }
            return { type: input.type, orderNumber: order.orderNumber, address: cleanAddress(input.address) };
        case "cancel_order":
            if (order.status !== "processing") throw new Error(`Order ${order.orderNumber} can no longer be cancelled`);
            return { type: input.type, orderNumber: order.orderNumber, reason: cleanText(input.reason, "Cancellation reason", 300) };
        default:
            throw new Error("Unsupported demo action");
    }
}

function actionSummary(input: DemoActionInput): string {
    switch (input.type) {
        case "return_order":
            return `Request a return for ${input.orderNumber}: ${input.reason}`;
        case "update_shipping_address":
            return `Change ${input.orderNumber} delivery address to ${input.address.line1}, ${input.address.city}, ${input.address.postalCode}, ${input.address.country}`;
        case "cancel_order":
            return `Cancel ${input.orderNumber}: ${input.reason}`;
        default:
            throw new Error("Unsupported demo action");
    }
}

export function prepareDemoAction(database: Database, input: DemoActionInput): ActionConfirmation {
    const orderNumber = normalizedOrderNumber(input.orderNumber);
    const order = orderForAction(database, orderNumber);
    const validated = validateAction(order, { ...input, orderNumber } as DemoActionInput);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 15 * 60 * 1_000).toISOString();
    const actionId = crypto.randomUUID();
    database.transaction(() => {
        database
            .query<never, [number, string]>(
                "UPDATE pending_actions SET status = 'superseded' WHERE order_id = ? AND action_type = ? AND status = 'pending'",
            )
            .run(order.id, validated.type);
        database
            .query<never, [string, string, number, string, string, string]>(
                `INSERT INTO pending_actions
                 (action_id, action_type, order_id, payload_json, status, created_at, expires_at)
                 VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
            )
            .run(actionId, validated.type, order.id, JSON.stringify(validated), createdAt.toISOString(), expiresAt);
    })();
    return {
        actionId,
        actionType: validated.type,
        orderNumber,
        summary: actionSummary(validated),
        expiresAt,
    };
}

function pendingAction(database: Database, actionId: string): PendingActionRow {
    const row = database
        .query<PendingActionRow, [string]>(
            `SELECT pa.action_id AS actionId, pa.action_type AS actionType, pa.order_id AS orderId,
                    o.order_number AS orderNumber, pa.payload_json AS payloadJson, pa.status, pa.expires_at AS expiresAt
             FROM pending_actions pa JOIN orders o ON o.id = pa.order_id WHERE pa.action_id = ?`,
        )
        .get(actionId);
    if (!row) throw new Error("The requested action was not found");
    if (row.status !== "pending") throw new Error("The requested action is no longer pending");
    if (new Date(row.expiresAt).getTime() < Date.now()) throw new Error("The requested action has expired");
    return row;
}

function requestReturn(database: Database, row: PendingActionRow, input: Extract<DemoActionInput, { type: "return_order" }>): string {
    const returnId =
        database.query<{ id: number }, []>("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM returns").get()?.id ?? 1;
    const order = orderForAction(database, row.orderNumber);
    validateReturn(order, input.reason);
    database
        .query<never, [number, string, number, string, string, number]>(
            `INSERT INTO returns (id, return_number, order_id, status, reason, requested_at, refund_cents)
             VALUES (?, ?, ?, 'requested', ?, ?, ?)`,
        )
        .run(
            returnId,
            `RET-${String(returnId).padStart(5, "0")}`,
            row.orderId,
            input.reason,
            new Date().toISOString(),
            order.totalCents - order.shippingCents,
        );
    return `Return requested for ${row.orderNumber}`;
}

function updateAddress(
    database: Database,
    row: PendingActionRow,
    input: Extract<DemoActionInput, { type: "update_shipping_address" }>,
): string {
    const order = orderForAction(database, row.orderNumber);
    validateAction(order, input);
    database
        .query<never, [string, string, string, string, string, number]>(
            `UPDATE orders SET shipping_line1 = ?, shipping_city = ?, shipping_postal_code = ?,
                    shipping_country = ?, updated_at = ? WHERE id = ?`,
        )
        .run(
            input.address.line1,
            input.address.city,
            input.address.postalCode,
            input.address.country,
            new Date().toISOString(),
            row.orderId,
        );
    return `Shipping address updated for ${row.orderNumber}`;
}

function cancelOrder(database: Database, row: PendingActionRow, input: Extract<DemoActionInput, { type: "cancel_order" }>): string {
    const order = orderForAction(database, row.orderNumber);
    validateAction(order, input);
    const completedAt = new Date().toISOString();
    database.query<never, [string, number]>("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?").run(completedAt, row.orderId);
    database
        .query<never, [number]>("UPDATE payments SET status = CASE WHEN status = 'paid' THEN 'refunded' ELSE 'failed' END WHERE order_id = ?")
        .run(row.orderId);
    return `Order ${row.orderNumber} cancelled`;
}

export function confirmDemoAction(database: Database, actionId: string): DemoActionResult {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actionId)) {
        throw new Error("Invalid action identifier");
    }
    return database.transaction(() => {
        const row = pendingAction(database, actionId);
        const input = JSON.parse(row.payloadJson) as DemoActionInput;
        const message =
            input.type === "return_order"
                ? requestReturn(database, row, input)
                : input.type === "update_shipping_address"
                  ? updateAddress(database, row, input)
                  : cancelOrder(database, row, input);
        const completedAt = new Date().toISOString();
        database
            .query<never, [string, string]>(
                "UPDATE pending_actions SET status = 'completed', completed_at = ? WHERE action_id = ?",
            )
            .run(completedAt, actionId);
        database
            .query<never, [number, string, string, string]>(
                "INSERT INTO activity_log (order_id, event_type, details_json, created_at) VALUES (?, ?, ?, ?)",
            )
            .run(row.orderId, input.type, JSON.stringify({ actionId, message }), completedAt);
        return {
            actionId,
            actionType: input.type,
            orderNumber: row.orderNumber,
            status: "completed" as const,
            message,
            completedAt,
        };
    })();
}
