import {orderArguments, policyArguments, productsArguments} from '../toolArguments.ts';
import {euros, getRepository, normalizeOrderNumber} from '../toolRuntime.ts';
import type {ToolExecution} from '../toolTypes.ts';

export const productsHandler = (raw: unknown): ToolExecution =>
{
    const args = productsArguments.parse(raw);
    const hardFilters = {
        ...args.query && {query: args.query},
        ...args.category && {category: args.category},
        ...args.brands.length && {brands: args.brands},
        ...args.skus.length && {skus: args.skus},
        ...args.minimum_price_eur !== null && {minPriceCents: Math.round(args.minimum_price_eur * 100)},
        ...args.maximum_price_eur !== null && {maxPriceCents: Math.round(args.maximum_price_eur * 100)},
        ...args.minimum_rating !== null && {minRating: args.minimum_rating},
        ...args.minimum_stock !== null && {minStockQuantity: Math.round(args.minimum_stock)},
        ...args.maximum_stock !== null && {maxStockQuantity: Math.round(args.maximum_stock)},
        inStockOnly: args.in_stock_only,
        preferences: args.preferences,
        ...args.attribute_filters.length && {attributes: Object.fromEntries(args.attribute_filters.map(({key, value}) => [key, value]))},
        limit: args.limit
    };
    let matches = getRepository().searchProducts(hardFilters);
    let broadened = false;
    if (matches.length === 0 && (args.query || args.attribute_filters.length > 0))
    {
        broadened = true;
        const {query: _query, attributes: _attributes, preferences, ...boundedFilters} = hardFilters;
        matches = getRepository().searchProducts({
            ...boundedFilters,
            preferences: [...preferences, ...args.query ? [args.query] : [], ...args.attribute_filters.map(({value}) => String(value))]
        });
    }

    const blockId = crypto.randomUUID();
    const exactProduct = args.skus.length === 1 && matches.length === 1 ? matches[0] : undefined;

    return {
        modelOutput: {
            products: matches,
            broadenedSoftSearch: broadened,
            hardConstraintsRetained: {
                category: args.category,
                maximumPriceEur: args.maximum_price_eur,
                inStockOnly: args.in_stock_only
            }
        },
        blocks: matches.length === 0 ? [] : exactProduct ? [{
            id: blockId,
            type: 'stats',
            title: exactProduct.name,
            description: exactProduct.description,
            items: [
                {label: 'Price', value: `€${euros(exactProduct.priceCents).toLocaleString()}`},
                {label: 'Rating', value: `${exactProduct.rating.toFixed(1)} / 5`},
                {label: 'In stock', value: exactProduct.stockQuantity},
                {label: 'Category', value: exactProduct.category}
            ]
        }] : [{
            id: blockId,
            type: 'choices',
            title: 'Recommended products',
            description: 'Choose one to continue the conversation.',
            interactionId: `product-selection:${blockId}`,
            options: matches.map((product) => ({
                value: product.sku,
                label: product.name,
                description: product.description,
                meta: `€${euros(product.priceCents).toLocaleString()} · ${product.rating.toFixed(1)}★`
            }))
        }]
    };
};

export const orderHandler = (raw: unknown): ToolExecution =>
{
    const args = orderArguments.parse(raw);
    const normalizedOrderNumber = normalizeOrderNumber(args.order_number);
    const details = getRepository().getOrder(normalizedOrderNumber);
    if (!details)
    {
        return {modelOutput: {found: false, orderNumber: normalizedOrderNumber}, blocks: []};
    }
    return {
        modelOutput: {found: true, order: details},
        blocks: [
            {
                id: crypto.randomUUID(),
                type: 'stats',
                title: details.orderNumber,
                items: [
                    {label: 'Status', value: details.status},
                    {label: 'Total', value: `€${euros(details.totalCents).toLocaleString()}`},
                    {label: 'Items', value: details.itemCount},
                    {label: 'Region', value: details.region}
                ]
            },
            {
                id: crypto.randomUUID(),
                type: 'table',
                title: `Items in ${details.orderNumber}`,
                columns: [
                    {key: 'sku', label: 'SKU'},
                    {key: 'product', label: 'Product'},
                    {key: 'quantity', label: 'Qty', format: 'number'},
                    {key: 'unitPrice', label: 'Unit price', format: 'currency'},
                    {key: 'total', label: 'Total', format: 'currency'}
                ],
                rows: details.items.map((item) => ({
                    sku: item.sku,
                    product: item.productName,
                    quantity: item.quantity,
                    unitPrice: euros(item.unitPriceCents),
                    total: euros(item.lineTotalCents)
                })),
                rowKey: 'sku'
            }
        ]
    };
};

export const policiesHandler = (raw: unknown): ToolExecution =>
{
    const args = policyArguments.parse(raw);
    const matches = getRepository().searchPolicies(args.query, args.limit);
    return {
        modelOutput: {matches},
        blocks: matches.length === 0 ? [] : [{
            id: crypto.randomUUID(),
            type: 'sources',
            title: 'Policy sources',
            items: matches.map((match) => ({
                title: `${match.title} — ${match.section}`,
                excerpt: match.excerpt,
                source: match.sourcePath
            }))
        }]
    };
};
