import type { Database } from "bun:sqlite";
import type {
    CategorySales,
    DashboardFilters,
    DashboardMetric,
    DashboardSnapshot,
    RegionalSales,
    SalesSeriesPoint,
} from "../types.ts";
import { endOfDay, type SqlParameter, startOfDay } from "./helpers.ts";

interface AggregateRow {
    orders: number;
    revenueCents: number;
}

function range(filters: DashboardFilters): { from: string; to: string; previousFrom: string; previousTo: string } {
    const from = startOfDay(filters.from ?? "2026-01-01");
    const to = endOfDay(filters.to ?? "2026-06-30");
    const fromTime = new Date(from).getTime();
    const toTime = new Date(to).getTime();
    if (fromTime > toTime) throw new Error("Dashboard start date must not be after end date");
    const duration = toTime - fromTime + 1;
    const previousToTime = fromTime - 1;
    return {
        from,
        to,
        previousFrom: new Date(previousToTime - duration + 1).toISOString(),
        previousTo: new Date(previousToTime).toISOString(),
    };
}

function salesWhere(
    from: string,
    to: string,
    region: DashboardFilters["region"],
    alias = "o",
): { clause: string; parameters: SqlParameter[] } {
    const parameters: SqlParameter[] = [from, to];
    let clause = `${alias}.created_at BETWEEN ? AND ? AND ${alias}.status NOT IN ('cancelled', 'returned')`;
    if (region) {
        clause += ` AND ${alias}.region = ?`;
        parameters.push(region);
    }
    return { clause, parameters };
}

function aggregate(database: Database, from: string, to: string, region?: DashboardFilters["region"]): AggregateRow {
    const where = salesWhere(from, to, region);
    return (
        database
            .query<AggregateRow, SqlParameter[]>(
                `SELECT COUNT(*) AS orders, COALESCE(SUM(total_cents), 0) AS revenueCents FROM orders o WHERE ${where.clause}`,
            )
            .get(...where.parameters) ?? { orders: 0, revenueCents: 0 }
    );
}

function metric(current: number, previous: number): DashboardMetric {
    return {
        current,
        previous,
        changePercent: previous === 0 ? null : Number((((current - previous) / previous) * 100).toFixed(1)),
    };
}

export function queryDashboard(database: Database, filters: DashboardFilters = {}): DashboardSnapshot {
    const dates = range(filters);
    const current = aggregate(database, dates.from, dates.to, filters.region);
    const previous = aggregate(database, dates.previousFrom, dates.previousTo, filters.region);
    const where = salesWhere(dates.from, dates.to, filters.region);

    const salesByMonth = database
        .query<SalesSeriesPoint, SqlParameter[]>(
            `SELECT substr(o.created_at, 1, 7) AS period, COUNT(DISTINCT o.id) AS orders,
                    COALESCE(SUM(o.total_cents), 0) AS revenueCents
             FROM orders o WHERE ${where.clause} GROUP BY period ORDER BY period`,
        )
        .all(...where.parameters);
    const salesByCategory = database
        .query<CategorySales, SqlParameter[]>(
            `SELECT p.category, SUM(oi.quantity) AS itemsSold,
                    SUM(oi.line_total_cents - ROUND(oi.line_total_cents * o.discount_cents * 1.0 / o.subtotal_cents)) AS revenueCents
             FROM orders o JOIN order_items oi ON oi.order_id = o.id JOIN products p ON p.id = oi.product_id
             WHERE ${where.clause} GROUP BY p.category ORDER BY revenueCents DESC`,
        )
        .all(...where.parameters);
    const salesByRegion = database
        .query<RegionalSales, SqlParameter[]>(
            `SELECT o.region, COUNT(*) AS orders, COALESCE(SUM(o.total_cents), 0) AS revenueCents
             FROM orders o WHERE ${where.clause} GROUP BY o.region ORDER BY revenueCents DESC`,
        )
        .all(...where.parameters);
    const delayedWhere = [dates.from, dates.to, ...(filters.region ? [filters.region] : [])];
    const delayedOrders =
        database
            .query<{ count: number }, SqlParameter[]>(
                `SELECT COUNT(*) AS count FROM orders WHERE created_at BETWEEN ? AND ? AND status = 'delayed'${
                    filters.region ? " AND region = ?" : ""
                }`,
            )
            .get(...delayedWhere)?.count ?? 0;
    const openSupportCases =
        database
            .query<{ count: number }, SqlParameter[]>(
                `SELECT COUNT(*) AS count FROM support_cases sc JOIN orders o ON o.id = sc.order_id
                 WHERE sc.status != 'resolved'${filters.region ? " AND o.region = ?" : ""}`,
            )
            .get(...(filters.region ? [filters.region] : []))?.count ?? 0;

    return {
        range: { from: dates.from, to: dates.to },
        currency: "EUR",
        revenue: metric(current.revenueCents, previous.revenueCents),
        orderCount: metric(current.orders, previous.orders),
        averageOrderValueCents: current.orders === 0 ? 0 : Math.round(current.revenueCents / current.orders),
        delayedOrders,
        openSupportCases,
        salesByMonth,
        salesByCategory,
        salesByRegion,
    };
}
