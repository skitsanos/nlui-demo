export type OrderStatus =
    | "cancelled"
    | "delayed"
    | "delivered"
    | "processing"
    | "returned"
    | "shipped";

export type CustomerRegion = "Central" | "East" | "North" | "South" | "West";

export interface DataLayerOptions {
    databasePath?: string;
    knowledgePath?: string;
}

export interface EnsureDatabaseResult {
    databasePath: string;
    datasetVersion: number;
    seeded: boolean;
    summary: SeedSummary;
}

export interface SeedSummary {
    customers: number;
    products: number;
    orders: number;
    orderItems: number;
    payments: number;
    shipments: number;
    returns: number;
    supportCases: number;
    policyDocuments: number;
}

export interface DashboardFilters {
    from?: string;
    to?: string;
    region?: CustomerRegion;
}

export interface DashboardMetric {
    current: number;
    previous: number;
    changePercent: number | null;
}

export interface SalesSeriesPoint {
    period: string;
    orders: number;
    revenueCents: number;
}

export interface CategorySales {
    category: string;
    itemsSold: number;
    revenueCents: number;
}

export interface RegionalSales {
    region: CustomerRegion;
    orders: number;
    revenueCents: number;
}

export interface DashboardSnapshot {
    range: { from: string; to: string };
    currency: "EUR";
    revenue: DashboardMetric;
    orderCount: DashboardMetric;
    averageOrderValueCents: number;
    delayedOrders: number;
    openSupportCases: number;
    salesByMonth: SalesSeriesPoint[];
    salesByCategory: CategorySales[];
    salesByRegion: RegionalSales[];
}

export interface OrderFilters {
    search?: string;
    statuses?: OrderStatus[];
    region?: CustomerRegion;
    minTotalCents?: number;
    maxTotalCents?: number;
    from?: string;
    to?: string;
    customerId?: number;
    limit?: number;
    offset?: number;
    sort?: "created_asc" | "created_desc" | "total_asc" | "total_desc";
}

export interface Page<T> {
    items: T[];
    limit: number;
    offset: number;
    total: number;
}

export interface OrderSummary {
    orderNumber: string;
    customerId: number;
    customerName: string;
    region: CustomerRegion;
    status: OrderStatus;
    itemCount: number;
    totalCents: number;
    currency: "EUR";
    createdAt: string;
    expectedDeliveryAt: string | null;
}

export interface OrderLineItem {
    sku: string;
    productName: string;
    category: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
}

export interface OrderDetails extends OrderSummary {
    customerEmail: string;
    shippingAddress: ShippingAddress;
    subtotalCents: number;
    discountCents: number;
    shippingCents: number;
    taxCents: number;
    items: OrderLineItem[];
    payment: {
        method: string;
        status: string;
        paidAt: string | null;
    } | null;
    shipment: {
        carrier: string;
        trackingNumber: string;
        status: string;
        shippedAt: string | null;
        expectedDeliveryAt: string | null;
        deliveredAt: string | null;
    } | null;
    returns: Array<{
        returnNumber: string;
        status: string;
        reason: string;
        requestedAt: string;
        refundCents: number;
    }>;
}

export interface ShippingAddress {
    line1: string;
    city: string;
    postalCode: string;
    country: string;
}

export interface ProductSearchFilters {
    query?: string;
    skus?: string[];
    category?: string;
    brands?: string[];
    minPriceCents?: number;
    maxPriceCents?: number;
    minRating?: number;
    minStockQuantity?: number;
    maxStockQuantity?: number;
    inStockOnly?: boolean;
    preferences?: string[];
    attributes?: Record<string, string | number | boolean>;
    limit?: number;
}

export interface ProductSummary {
    sku: string;
    name: string;
    description: string;
    category: string;
    brand: string;
    priceCents: number;
    stockQuantity: number;
    rating: number;
    attributes: Record<string, string | number | boolean>;
}

export interface PolicyMatch {
    documentId: string;
    title: string;
    section: string;
    excerpt: string;
    score: number;
    sourcePath: string;
}

export type DemoActionInput =
    | {
          type: "return_order";
          orderNumber: string;
          reason: string;
      }
    | {
          type: "update_shipping_address";
          orderNumber: string;
          address: ShippingAddress;
      }
    | {
          type: "cancel_order";
          orderNumber: string;
          reason: string;
      };

export interface ActionConfirmation {
    actionId: string;
    actionType: DemoActionInput["type"];
    orderNumber: string;
    summary: string;
    expiresAt: string;
}

export interface DemoActionResult {
    actionId: string;
    actionType: DemoActionInput["type"];
    orderNumber: string;
    status: "completed";
    message: string;
    completedAt: string;
}

export interface DemoRepository {
    getDashboard(filters?: DashboardFilters): DashboardSnapshot;
    listOrders(filters?: OrderFilters): Page<OrderSummary>;
    searchProducts(filters?: ProductSearchFilters): ProductSummary[];
    getOrder(orderNumber: string | number): OrderDetails | null;
    searchPolicies(query: string, limit?: number): PolicyMatch[];
    prepareAction(input: DemoActionInput): ActionConfirmation;
    confirmAction(actionId: string): DemoActionResult;
    close(): void;
}
