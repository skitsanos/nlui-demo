import { Database } from "bun:sqlite";
import { confirmDemoAction, prepareDemoAction } from "./actions.ts";
import { queryDashboard } from "./queries/dashboard.ts";
import { queryOrder, queryOrders } from "./queries/orders.ts";
import { queryPolicies } from "./queries/policies.ts";
import { queryProducts } from "./queries/products.ts";
import { configureDatabase } from "./schema.ts";
import { ensureDemoDatabase } from "./seed.ts";
import type {
    ActionConfirmation,
    DashboardFilters,
    DashboardSnapshot,
    DataLayerOptions,
    DemoActionInput,
    DemoActionResult,
    DemoRepository,
    OrderDetails,
    OrderFilters,
    OrderSummary,
    Page,
    PolicyMatch,
    ProductSearchFilters,
    ProductSummary,
} from "./types.ts";

class SqliteDemoRepository implements DemoRepository {
    private readonly database: Database;
    private closed = false;

    constructor(databasePath: string) {
        this.database = new Database(databasePath, { create: false, readwrite: true, strict: true });
        configureDatabase(this.database);
    }

    getDashboard(filters?: DashboardFilters): DashboardSnapshot {
        this.assertOpen();
        return queryDashboard(this.database, filters);
    }

    listOrders(filters?: OrderFilters): Page<OrderSummary> {
        this.assertOpen();
        return queryOrders(this.database, filters);
    }

    searchProducts(filters?: ProductSearchFilters): ProductSummary[] {
        this.assertOpen();
        return queryProducts(this.database, filters);
    }

    getOrder(orderNumber: string | number): OrderDetails | null {
        this.assertOpen();
        return queryOrder(this.database, orderNumber);
    }

    searchPolicies(query: string, limit?: number): PolicyMatch[] {
        this.assertOpen();
        return queryPolicies(this.database, query, limit);
    }

    prepareAction(input: DemoActionInput): ActionConfirmation {
        this.assertOpen();
        return prepareDemoAction(this.database, input);
    }

    confirmAction(actionId: string): DemoActionResult {
        this.assertOpen();
        return confirmDemoAction(this.database, actionId);
    }

    close(): void {
        if (this.closed) return;
        this.database.close();
        this.closed = true;
    }

    private assertOpen(): void {
        if (this.closed) throw new Error("Demo repository is closed");
    }
}

export function createDemoRepository(options: DataLayerOptions = {}): DemoRepository {
    const ensured = ensureDemoDatabase(options);
    return new SqliteDemoRepository(ensured.databasePath);
}
