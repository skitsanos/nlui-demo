import { DATASET_REFERENCE_DATE } from "../constants.ts";
import type { OrderStatus } from "../types.ts";
import { customerLocation } from "./catalog.ts";
import { addDays, addHours, type SeededRandom } from "./random.ts";
import type {
    CustomerSeed,
    GeneratedDataset,
    OrderItemSeed,
    OrderSeed,
    PaymentSeed,
    ProductSeed,
    ReturnSeed,
    ShipmentSeed,
    SupportCaseSeed,
} from "./types.ts";

const STATUS_WEIGHTS: ReadonlyArray<readonly [OrderStatus, number]> = [
    ["delivered", 70],
    ["shipped", 8],
    ["delayed", 6],
    ["processing", 6],
    ["returned", 6],
    ["cancelled", 4],
];

const RETURN_REASONS = [
    "Changed my mind",
    "Item arrived damaged",
    "Item did not match the description",
    "Ordered the wrong model",
    "Performance did not meet expectations",
] as const;

const SUPPORT_SUBJECTS = [
    ["Delivery has not arrived", "shipping"],
    ["Question about a recent payment", "payment"],
    ["Need help choosing an accessory", "product_advice"],
    ["Return status question", "return"],
    ["Product setup assistance", "technical"],
] as const;

function orderStatus(orderId: number, random: SeededRandom): OrderStatus {
    if (orderId === 1042) return "delivered";
    if (orderId === 1176) return "processing";
    if (orderId === 1320 || orderId === 2088) return "delayed";
    return random.weighted(STATUS_WEIGHTS);
}

function createdAtFor(orderId: number, random: SeededRandom): string {
    if (orderId === 1042) return "2026-06-17T10:30:00.000Z";
    if (orderId === 1176) return "2026-06-29T08:15:00.000Z";
    if (orderId === 1320) return "2026-06-20T14:45:00.000Z";
    if (orderId === 2088) return "2026-06-18T16:20:00.000Z";
    return addHours("2025-01-01T00:00:00.000Z", random.integer(0, 545 * 24));
}

function productIdsFor(orderId: number, random: SeededRandom): number[] {
    if (orderId === 1042) return [2];
    if (orderId === 1176) return [12, 91];
    if (orderId === 1320) return [4, 16];
    if (orderId === 2088) return [3, 8];
    const count = random.weighted([
        [1, 45],
        [2, 32],
        [3, 17],
        [4, 6],
    ] as const);
    return random.shuffle(Array.from({ length: 100 }, (_, index) => index + 1)).slice(0, count);
}

function createItems(
    orderId: number,
    productIds: number[],
    products: ProductSeed[],
    random: SeededRandom,
    nextItemId: () => number,
): OrderItemSeed[] {
    return productIds.map((productId, index) => {
        const product = products[productId - 1]!;
        const quantity = orderId === 1320 && index === 0 ? 2 : random.weighted([[1, 88], [2, 10], [3, 2]] as const);
        return {
            id: nextItemId(),
            orderId,
            productId,
            quantity,
            unitPriceCents: product.priceCents,
            lineTotalCents: product.priceCents * quantity,
        };
    });
}

function createPayment(order: OrderSeed, random: SeededRandom): PaymentSeed {
    const isCancelled = order.status === "cancelled";
    const status = isCancelled
        ? random.pick(["failed", "refunded"] as const)
        : order.status === "processing" && order.id % 4 === 0
          ? "pending"
          : order.status === "returned"
            ? "refunded"
            : "paid";
    return {
        id: order.id - 1_000,
        orderId: order.id,
        method: random.pick(["card", "card", "digital_wallet", "bank_transfer"] as const),
        status,
        amountCents: order.totalCents,
        paidAt: status === "paid" || status === "refunded" ? addHours(order.createdAt, 1) : null,
    };
}

function createShipment(order: OrderSeed, random: SeededRandom): ShipmentSeed | null {
    if (order.status === "cancelled") return null;
    const shippedAt = order.status === "processing" ? null : addDays(order.createdAt, 1);
    const expectedDays = order.status === "delayed" ? 11 : 4 + (order.id % 3);
    const expectedDeliveryAt = addDays(order.createdAt, expectedDays);
    const deliveredAt =
        order.status === "delivered" || order.status === "returned"
            ? addDays(order.createdAt, order.id === 1042 ? 5 : 3 + (order.id % 4))
            : null;
    const status =
        order.status === "processing"
            ? "label_created"
            : order.status === "delayed"
              ? "delayed"
              : deliveredAt
                ? "delivered"
                : "in_transit";
    return {
        id: order.id - 1_000,
        orderId: order.id,
        carrier: random.pick(["DHL", "DPD", "GLS", "UPS"] as const),
        trackingNumber: `TRK-EU-${String(order.id).padStart(7, "0")}`,
        status,
        shippedAt,
        expectedDeliveryAt,
        deliveredAt,
    };
}

function createReturn(order: OrderSeed, random: SeededRandom, returnId: number): ReturnSeed {
    return {
        id: returnId,
        returnNumber: `RET-${String(returnId).padStart(5, "0")}`,
        orderId: order.id,
        status: random.pick(["completed", "completed", "received", "approved"] as const),
        reason: random.pick(RETURN_REASONS),
        requestedAt: addDays(order.createdAt, 8 + (order.id % 12)),
        refundCents: order.totalCents - order.shippingCents,
    };
}

function createSupportCase(order: OrderSeed, caseId: number): SupportCaseSeed {
    const subject = SUPPORT_SUBJECTS[caseId % SUPPORT_SUBJECTS.length]!;
    const forcedUrgent = order.id === 2088;
    const status = forcedUrgent ? "open" : caseId % 4 === 0 ? "resolved" : caseId % 3 === 0 ? "pending_customer" : "open";
    return {
        id: caseId,
        caseNumber: `CASE-${String(caseId).padStart(5, "0")}`,
        customerId: order.customerId,
        orderId: order.id,
        subject: forcedUrgent ? "High-value delayed order needs escalation" : subject[0],
        category: forcedUrgent ? "shipping" : subject[1],
        priority: forcedUrgent ? "urgent" : caseId % 7 === 0 ? "high" : caseId % 5 === 0 ? "low" : "normal",
        status,
        createdAt: addDays(order.createdAt, 2),
        updatedAt: addDays(order.createdAt, status === "resolved" ? 4 : 3),
    };
}

export function generateOrders(
    customers: CustomerSeed[],
    products: ProductSeed[],
    random: SeededRandom,
): Omit<GeneratedDataset, "customers" | "products"> {
    const orders: OrderSeed[] = [];
    const orderItems: OrderItemSeed[] = [];
    const payments: PaymentSeed[] = [];
    const shipments: ShipmentSeed[] = [];
    const returns: ReturnSeed[] = [];
    const supportCases: SupportCaseSeed[] = [];
    let itemId = 0;

    for (let id = 1_001; id <= 2_500; id += 1) {
        const customer = customers[id === 1042 ? 41 : (id * 17) % customers.length]!;
        const status = orderStatus(id, random);
        const createdAt = createdAtFor(id, random);
        const items = createItems(id, productIdsFor(id, random), products, random, () => (itemId += 1));
        const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
        const discountRate = customer.tier === "gold" ? 0.1 : customer.tier === "silver" ? 0.05 : id % 11 === 0 ? 0.05 : 0;
        const discountCents = Math.round(subtotalCents * discountRate);
        const shippingCents = subtotalCents - discountCents >= 10_000 ? 0 : 799;
        const taxCents = Math.round((subtotalCents - discountCents + shippingCents) * 0.19);
        const address = customerLocation(customer);
        const order: OrderSeed = {
            id,
            orderNumber: `ORD-${id}`,
            customerId: customer.id,
            status,
            region: customer.region,
            subtotalCents,
            discountCents,
            shippingCents,
            taxCents,
            totalCents: subtotalCents - discountCents + shippingCents + taxCents,
            shippingLine1: address.line1,
            shippingCity: address.city,
            shippingPostalCode: address.postalCode,
            shippingCountry: address.country,
            createdAt,
            updatedAt: status === "processing" ? createdAt : addDays(createdAt, 1),
        };
        orders.push(order);
        orderItems.push(...items);
        payments.push(createPayment(order, random));
        const shipment = createShipment(order, random);
        if (shipment) shipments.push(shipment);
        if (status === "returned") returns.push(createReturn(order, random, returns.length + 1));
        if (id % 9 === 0 || id === 2088) supportCases.push(createSupportCase(order, supportCases.length + 1));
    }

    if (new Date(DATASET_REFERENCE_DATE) < new Date(orders.at(-1)!.createdAt)) {
        throw new Error("Generated order date exceeds the dataset reference date");
    }

    return { orders, orderItems, payments, shipments, returns, supportCases };
}
