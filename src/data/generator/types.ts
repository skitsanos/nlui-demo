import type { CustomerRegion, OrderStatus } from "../types.ts";

export interface CustomerSeed {
    id: number;
    customerNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    region: CustomerRegion;
    city: string;
    country: string;
    tier: "gold" | "silver" | "standard";
    joinedAt: string;
}

export interface ProductSeed {
    id: number;
    sku: string;
    name: string;
    description: string;
    category: string;
    brand: string;
    priceCents: number;
    stockQuantity: number;
    rating: number;
    active: number;
    attributes: Record<string, string | number | boolean>;
}

export interface OrderSeed {
    id: number;
    orderNumber: string;
    customerId: number;
    status: OrderStatus;
    region: CustomerRegion;
    subtotalCents: number;
    discountCents: number;
    shippingCents: number;
    taxCents: number;
    totalCents: number;
    shippingLine1: string;
    shippingCity: string;
    shippingPostalCode: string;
    shippingCountry: string;
    createdAt: string;
    updatedAt: string;
}

export interface OrderItemSeed {
    id: number;
    orderId: number;
    productId: number;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
}

export interface PaymentSeed {
    id: number;
    orderId: number;
    method: "bank_transfer" | "card" | "digital_wallet";
    status: "failed" | "paid" | "pending" | "refunded";
    amountCents: number;
    paidAt: string | null;
}

export interface ShipmentSeed {
    id: number;
    orderId: number;
    carrier: string;
    trackingNumber: string;
    status: "delayed" | "delivered" | "in_transit" | "label_created";
    shippedAt: string | null;
    expectedDeliveryAt: string | null;
    deliveredAt: string | null;
}

export interface ReturnSeed {
    id: number;
    returnNumber: string;
    orderId: number;
    status: "approved" | "completed" | "received" | "requested";
    reason: string;
    requestedAt: string;
    refundCents: number;
}

export interface SupportCaseSeed {
    id: number;
    caseNumber: string;
    customerId: number;
    orderId: number | null;
    subject: string;
    category: string;
    priority: "high" | "low" | "normal" | "urgent";
    status: "open" | "pending_customer" | "resolved";
    createdAt: string;
    updatedAt: string;
}

export interface GeneratedDataset {
    customers: CustomerSeed[];
    products: ProductSeed[];
    orders: OrderSeed[];
    orderItems: OrderItemSeed[];
    payments: PaymentSeed[];
    shipments: ShipmentSeed[];
    returns: ReturnSeed[];
    supportCases: SupportCaseSeed[];
}
