import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import {
    DATASET_ID,
    DATASET_REFERENCE_DATE,
    DATASET_SEED,
    DATASET_VERSION,
    DEFAULT_DATABASE_PATH,
    DEFAULT_KNOWLEDGE_PATH,
    EXPECTED_COUNTS,
} from "./constants.ts";
import { generateCustomers, generateProducts } from "./generator/catalog.ts";
import { generateOrders } from "./generator/orders.ts";
import { SeededRandom } from "./generator/random.ts";
import type { GeneratedDataset } from "./generator/types.ts";
import { loadPolicyDocuments, type PolicyDocumentSeed } from "./policy-loader.ts";
import { configureDatabase, recreateSchema } from "./schema.ts";
import type { DataLayerOptions, EnsureDatabaseResult, SeedSummary } from "./types.ts";

function generateDataset(): GeneratedDataset {
    const random = new SeededRandom(DATASET_SEED);
    const customers = generateCustomers(random);
    const products = generateProducts(random);
    return { customers, products, ...generateOrders(customers, products, random) };
}

function insertDataset(database: Database, dataset: GeneratedDataset, policies: PolicyDocumentSeed[]): void {
    const insertCustomer = database.prepare(
        "INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const insertProduct = database.prepare("INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const insertOrder = database.prepare("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const insertItem = database.prepare("INSERT INTO order_items VALUES (?, ?, ?, ?, ?, ?)");
    const insertPayment = database.prepare("INSERT INTO payments VALUES (?, ?, ?, ?, ?, ?)");
    const insertShipment = database.prepare("INSERT INTO shipments VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    const insertReturn = database.prepare("INSERT INTO returns VALUES (?, ?, ?, ?, ?, ?, ?)");
    const insertCase = database.prepare("INSERT INTO support_cases VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const insertPolicy = database.prepare("INSERT INTO policy_documents VALUES (?, ?, ?, ?, ?)");
    const insertMetadata = database.prepare("INSERT INTO dataset_metadata VALUES (?, ?)");

    database.transaction(() => {
        for (const customer of dataset.customers) {
            insertCustomer.run(
                customer.id,
                customer.customerNumber,
                customer.firstName,
                customer.lastName,
                customer.email,
                customer.phone,
                customer.region,
                customer.city,
                customer.country,
                customer.tier,
                customer.joinedAt,
            );
        }
        for (const product of dataset.products) {
            insertProduct.run(
                product.id,
                product.sku,
                product.name,
                product.description,
                product.category,
                product.brand,
                product.priceCents,
                product.stockQuantity,
                product.rating,
                product.active,
                JSON.stringify(product.attributes),
            );
        }
        for (const order of dataset.orders) {
            insertOrder.run(
                order.id,
                order.orderNumber,
                order.customerId,
                order.status,
                order.region,
                order.subtotalCents,
                order.discountCents,
                order.shippingCents,
                order.taxCents,
                order.totalCents,
                "EUR",
                order.shippingLine1,
                order.shippingCity,
                order.shippingPostalCode,
                order.shippingCountry,
                order.createdAt,
                order.updatedAt,
            );
        }
        for (const item of dataset.orderItems) {
            insertItem.run(item.id, item.orderId, item.productId, item.quantity, item.unitPriceCents, item.lineTotalCents);
        }
        for (const payment of dataset.payments) {
            insertPayment.run(
                payment.id,
                payment.orderId,
                payment.method,
                payment.status,
                payment.amountCents,
                payment.paidAt,
            );
        }
        for (const shipment of dataset.shipments) {
            insertShipment.run(
                shipment.id,
                shipment.orderId,
                shipment.carrier,
                shipment.trackingNumber,
                shipment.status,
                shipment.shippedAt,
                shipment.expectedDeliveryAt,
                shipment.deliveredAt,
            );
        }
        for (const itemReturn of dataset.returns) {
            insertReturn.run(
                itemReturn.id,
                itemReturn.returnNumber,
                itemReturn.orderId,
                itemReturn.status,
                itemReturn.reason,
                itemReturn.requestedAt,
                itemReturn.refundCents,
            );
        }
        for (const supportCase of dataset.supportCases) {
            insertCase.run(
                supportCase.id,
                supportCase.caseNumber,
                supportCase.customerId,
                supportCase.orderId,
                supportCase.subject,
                supportCase.category,
                supportCase.priority,
                supportCase.status,
                supportCase.createdAt,
                supportCase.updatedAt,
            );
        }
        for (const policy of policies) {
            insertPolicy.run(policy.id, policy.title, policy.tags, policy.body, policy.sourcePath);
        }
        const metadata = {
            dataset_id: DATASET_ID,
            dataset_version: String(DATASET_VERSION),
            reference_date: DATASET_REFERENCE_DATE,
            seed: String(DATASET_SEED),
        };
        for (const [key, value] of Object.entries(metadata)) insertMetadata.run(key, value);
    })();
}

function count(database: Database, table: string): number {
    const row = database.query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM ${table}`).get();
    return row?.count ?? 0;
}

function readSummary(database: Database): SeedSummary {
    return {
        customers: count(database, "customers"),
        products: count(database, "products"),
        orders: count(database, "orders"),
        orderItems: count(database, "order_items"),
        payments: count(database, "payments"),
        shipments: count(database, "shipments"),
        returns: count(database, "returns"),
        supportCases: count(database, "support_cases"),
        policyDocuments: count(database, "policy_documents"),
    };
}

function validateSummary(summary: SeedSummary): void {
    if (
        summary.customers !== EXPECTED_COUNTS.customers ||
        summary.products !== EXPECTED_COUNTS.products ||
        summary.orders !== EXPECTED_COUNTS.orders ||
        summary.orderItems < summary.orders ||
        summary.policyDocuments < 1
    ) {
        throw new Error(`Demo seed validation failed: ${JSON.stringify(summary)}`);
    }
}

function seedDatabase(options: DataLayerOptions): SeedSummary {
    const databasePath = options.databasePath ?? DEFAULT_DATABASE_PATH;
    const knowledgePath = options.knowledgePath ?? DEFAULT_KNOWLEDGE_PATH;
    mkdirSync(dirname(databasePath), { recursive: true });
    const database = new Database(databasePath, { create: true, readwrite: true, strict: true });
    try {
        configureDatabase(database);
        recreateSchema(database);
        insertDataset(database, generateDataset(), loadPolicyDocuments(knowledgePath));
        const summary = readSummary(database);
        validateSummary(summary);
        database.run(`PRAGMA user_version = ${DATASET_VERSION}`);
        return summary;
    } finally {
        database.close();
    }
}

function existingDataset(databasePath: string): { datasetId: string; version: number; summary: SeedSummary } | null {
    const database = new Database(databasePath, { readonly: true, strict: true });
    try {
        const hasMetadata = database
            .query<{ found: number }, []>(
                "SELECT COUNT(*) AS found FROM sqlite_master WHERE type = 'table' AND name = 'dataset_metadata'",
            )
            .get()?.found;
        if (!hasMetadata) return null;
        const rows = database.query<{ key: string; value: string }, []>("SELECT key, value FROM dataset_metadata").all();
        const metadata = Object.fromEntries(rows.map((row) => [row.key, row.value]));
        return {
            datasetId: metadata.dataset_id ?? "",
            version: Number(metadata.dataset_version ?? 0),
            summary: readSummary(database),
        };
    } finally {
        database.close();
    }
}

export function resetDemoDatabase(options: DataLayerOptions = {}): SeedSummary {
    return seedDatabase(options);
}

export function ensureDemoDatabase(options: DataLayerOptions = {}): EnsureDatabaseResult {
    const databasePath = options.databasePath ?? DEFAULT_DATABASE_PATH;
    const shouldSeed = !existsSync(databasePath) || statSync(databasePath).size === 0;
    if (shouldSeed) {
        const summary = seedDatabase(options);
        return { databasePath, datasetVersion: DATASET_VERSION, seeded: true, summary };
    }
    const existing = existingDataset(databasePath);
    if (!existing || existing.datasetId !== DATASET_ID || existing.version !== DATASET_VERSION) {
        throw new Error(`Refusing to replace an unknown or incompatible database at ${databasePath}; run reset-demo explicitly`);
    }
    validateSummary(existing.summary);
    return { databasePath, datasetVersion: DATASET_VERSION, seeded: false, summary: existing.summary };
}
