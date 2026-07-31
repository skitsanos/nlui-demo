import {dashboardArguments, ordersArguments} from '../toolArguments.ts';
import {euros, getRepository, percentTrend} from '../toolRuntime.ts';
import type {ToolExecution} from '../toolTypes.ts';

export const dashboardHandler = (raw: unknown): ToolExecution =>
{
    const args = dashboardArguments.parse(raw);
    const snapshot = getRepository().getDashboard({
        ...args.from && {from: args.from},
        ...args.to && {to: args.to},
        ...args.region && {region: args.region}
    });
    const series = args.group_by === 'month' ? snapshot.salesByMonth.map((point) => ({label: point.period, value: euros(point.revenueCents)}))
        : args.group_by === 'category' ? snapshot.salesByCategory.map((point) => ({label: point.category, value: euros(point.revenueCents)}))
            : snapshot.salesByRegion.map((point) => ({label: point.region, value: euros(point.revenueCents)}));

    return {
        modelOutput: {...snapshot, displaySeries: series},
        blocks: [
            {
                id: crypto.randomUUID(),
                type: 'stats',
                items: [
                    {label: 'Revenue', value: `€${euros(snapshot.revenue.current).toLocaleString()}`, trend: percentTrend(snapshot.revenue.changePercent)},
                    {label: 'Orders', value: snapshot.orderCount.current, trend: percentTrend(snapshot.orderCount.changePercent)},
                    {label: 'Average order', value: `€${euros(snapshot.averageOrderValueCents).toLocaleString()}`},
                    {label: 'Delayed', value: snapshot.delayedOrders, trend: snapshot.delayedOrders > 0 ? 'down' : 'flat'}
                ]
            },
            {
                id: crypto.randomUUID(),
                type: 'chart',
                title: `Revenue by ${args.group_by}`,
                variant: args.group_by === 'month' ? 'line' : 'bar',
                categoryKey: 'label',
                valueKey: 'value',
                valueLabel: 'Revenue (EUR)',
                ...args.group_by === 'month' && {categoryFormat: 'date' as const},
                data: series
            }
        ]
    };
};

export const ordersHandler = (raw: unknown): ToolExecution =>
{
    const args = ordersArguments.parse(raw);
    const page = getRepository().listOrders({
        ...args.search && {search: args.search},
        ...args.statuses.length && {statuses: args.statuses},
        ...args.region && {region: args.region},
        ...args.minimum_total_eur !== null && {minTotalCents: Math.round(args.minimum_total_eur * 100)},
        ...args.maximum_total_eur !== null && {maxTotalCents: Math.round(args.maximum_total_eur * 100)},
        ...args.from && {from: args.from},
        ...args.to && {to: args.to},
        sort: args.sort,
        limit: args.limit
    });
    const rows = page.items.map((order) => ({
        order: order.orderNumber,
        customer: order.customerName,
        region: order.region,
        status: order.status,
        items: order.itemCount,
        total: euros(order.totalCents),
        created: order.createdAt.slice(0, 10),
        expectedDeliveryAt: order.expectedDeliveryAt?.slice(0, 10) ?? null
    }));

    const summary = {
        matchedOrderCount: page.total,
        returnedOrderCount: rows.length,
        totalsAreIn: 'EUR',
        appliedFilters: {
            statuses: args.statuses,
            region: args.region,
            minimumTotalEur: args.minimum_total_eur,
            maximumTotalEur: args.maximum_total_eur,
            sort: args.sort
        }
    };
    return {
        modelOutput: {...summary, dataLocation: 'trusted_ui_block'},
        traceOutput: {...summary, orders: rows},
        blocks: [{
            id: crypto.randomUUID(),
            type: 'table',
            title: page.total > rows.length
                ? `Showing ${rows.length} of ${page.total.toLocaleString()} matching orders`
                : `${page.total.toLocaleString()} matching order${page.total === 1 ? '' : 's'}`,
            columns: [
                {key: 'order', label: 'Order'},
                {key: 'customer', label: 'Customer'},
                {key: 'region', label: 'Region'},
                {key: 'status', label: 'Status', format: 'status'},
                {key: 'items', label: 'Items', format: 'number'},
                {key: 'total', label: 'Total', format: 'currency'},
                {key: 'created', label: 'Created', format: 'date'},
                {key: 'expectedDeliveryAt', label: 'Expected delivery', format: 'date'}
            ],
            rows,
            rowKey: 'order'
        }]
    };
};
