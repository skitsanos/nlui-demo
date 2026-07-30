import type { Database } from "bun:sqlite";

const DROP_SCHEMA = `
    DROP TABLE IF EXISTS pending_actions;
    DROP TABLE IF EXISTS activity_log;
    DROP TABLE IF EXISTS support_cases;
    DROP TABLE IF EXISTS returns;
    DROP TABLE IF EXISTS shipments;
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS order_items;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS policy_documents;
    DROP TABLE IF EXISTS dataset_metadata;
`;

const CREATE_SCHEMA = `
    CREATE TABLE dataset_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    ) STRICT;

    CREATE TABLE customers (
        id INTEGER PRIMARY KEY,
        customer_number TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL,
        region TEXT NOT NULL CHECK (region IN ('Central', 'East', 'North', 'South', 'West')),
        city TEXT NOT NULL,
        country TEXT NOT NULL,
        tier TEXT NOT NULL CHECK (tier IN ('standard', 'silver', 'gold')),
        joined_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        sku TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        brand TEXT NOT NULL,
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        stock_quantity INTEGER NOT NULL CHECK (stock_quantity >= 0),
        rating REAL NOT NULL CHECK (rating >= 0 AND rating <= 5),
        active INTEGER NOT NULL CHECK (active IN (0, 1)),
        attributes_json TEXT NOT NULL CHECK (json_valid(attributes_json))
    ) STRICT;

    CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        order_number TEXT NOT NULL UNIQUE,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        status TEXT NOT NULL CHECK (status IN ('cancelled', 'delayed', 'delivered', 'processing', 'returned', 'shipped')),
        region TEXT NOT NULL CHECK (region IN ('Central', 'East', 'North', 'South', 'West')),
        subtotal_cents INTEGER NOT NULL,
        discount_cents INTEGER NOT NULL,
        shipping_cents INTEGER NOT NULL,
        tax_cents INTEGER NOT NULL,
        total_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
        shipping_line1 TEXT NOT NULL,
        shipping_city TEXT NOT NULL,
        shipping_postal_code TEXT NOT NULL,
        shipping_country TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE order_items (
        id INTEGER PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
        line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0),
        UNIQUE (order_id, product_id)
    ) STRICT;

    CREATE TABLE payments (
        id INTEGER PRIMARY KEY,
        order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
        method TEXT NOT NULL CHECK (method IN ('bank_transfer', 'card', 'digital_wallet')),
        status TEXT NOT NULL CHECK (status IN ('failed', 'paid', 'pending', 'refunded')),
        amount_cents INTEGER NOT NULL,
        paid_at TEXT
    ) STRICT;

    CREATE TABLE shipments (
        id INTEGER PRIMARY KEY,
        order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
        carrier TEXT NOT NULL,
        tracking_number TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('delayed', 'delivered', 'in_transit', 'label_created')),
        shipped_at TEXT,
        expected_delivery_at TEXT,
        delivered_at TEXT
    ) STRICT;

    CREATE TABLE returns (
        id INTEGER PRIMARY KEY,
        return_number TEXT NOT NULL UNIQUE,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (status IN ('approved', 'completed', 'received', 'requested')),
        reason TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        refund_cents INTEGER NOT NULL CHECK (refund_cents >= 0)
    ) STRICT;

    CREATE TABLE support_cases (
        id INTEGER PRIMARY KEY,
        case_number TEXT NOT NULL UNIQUE,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        order_id INTEGER REFERENCES orders(id),
        subject TEXT NOT NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        status TEXT NOT NULL CHECK (status IN ('open', 'pending_customer', 'resolved')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE policy_documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        tags TEXT NOT NULL,
        body TEXT NOT NULL,
        source_path TEXT NOT NULL UNIQUE
    ) STRICT;

    CREATE TABLE pending_actions (
        action_id TEXT PRIMARY KEY,
        action_type TEXT NOT NULL CHECK (action_type IN ('cancel_order', 'return_order', 'update_shipping_address')),
        order_id INTEGER NOT NULL REFERENCES orders(id),
        payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
        status TEXT NOT NULL CHECK (status IN ('completed', 'pending', 'superseded')),
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        completed_at TEXT
    ) STRICT;

    CREATE TABLE activity_log (
        id INTEGER PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        event_type TEXT NOT NULL,
        details_json TEXT NOT NULL CHECK (json_valid(details_json)),
        created_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX idx_orders_created_at ON orders(created_at);
    CREATE INDEX idx_orders_status_total ON orders(status, total_cents);
    CREATE INDEX idx_orders_region ON orders(region);
    CREATE INDEX idx_order_items_product ON order_items(product_id);
    CREATE INDEX idx_products_category_price ON products(category, price_cents);
    CREATE INDEX idx_shipments_status ON shipments(status);
    CREATE INDEX idx_support_cases_status ON support_cases(status);
`;

export function configureDatabase(database: Database): void {
    database.run("PRAGMA foreign_keys = ON");
    database.run("PRAGMA journal_mode = WAL");
    database.run("PRAGMA synchronous = NORMAL");
    database.run("PRAGMA busy_timeout = 5000");
}

export function recreateSchema(database: Database): void {
    database.transaction(() => {
        database.run("PRAGMA foreign_keys = OFF");
        database.run(DROP_SCHEMA);
        database.run("PRAGMA foreign_keys = ON");
        database.run(CREATE_SCHEMA);
    })();
}
