import type { Database } from "bun:sqlite";
import type { ProductSearchFilters, ProductSummary } from "../types.ts";
import { clampInteger, type SqlParameter } from "./helpers.ts";

interface ProductRow extends Omit<ProductSummary, "attributes"> {
    attributesJson: string;
}

function preferenceScore(product: ProductSummary, preferences: string[]): number {
    const haystack = [product.name, product.description, product.category, product.brand, JSON.stringify(product.attributes)]
        .join(" ")
        .toLowerCase();
    return preferences.reduce((score, preference) => score + (haystack.includes(preference.toLowerCase()) ? 1 : 0), 0);
}

export function queryProducts(database: Database, filters: ProductSearchFilters = {}): ProductSummary[] {
    const clauses = ["active = 1"];
    const parameters: SqlParameter[] = [];
    if (filters.query?.trim()) {
        const search = `%${filters.query.trim()}%`;
        clauses.push(
            "(sku LIKE ? COLLATE NOCASE OR name LIKE ? COLLATE NOCASE OR description LIKE ? COLLATE NOCASE OR brand LIKE ? COLLATE NOCASE)",
        );
        parameters.push(search, search, search, search);
    }
    if (filters.skus?.length) {
        const skus = [...new Set(filters.skus.map((sku) => sku.trim().toUpperCase()).filter(Boolean))];
        if (skus.length) {
            clauses.push(`sku IN (${skus.map(() => "?").join(", ")})`);
            parameters.push(...skus);
        }
    }
    if (filters.category?.trim()) {
        clauses.push("category = ? COLLATE NOCASE");
        parameters.push(filters.category.trim());
    }
    if (filters.brands?.length) {
        const brands = [...new Set(filters.brands.map((brand) => brand.trim()).filter(Boolean))];
        if (brands.length) {
            clauses.push(`brand IN (${brands.map(() => "?").join(", ")})`);
            parameters.push(...brands);
        }
    }
    if (filters.minPriceCents !== undefined) {
        clauses.push("price_cents >= ?");
        parameters.push(Math.max(0, Math.trunc(filters.minPriceCents)));
    }
    if (filters.maxPriceCents !== undefined) {
        clauses.push("price_cents <= ?");
        parameters.push(Math.max(0, Math.trunc(filters.maxPriceCents)));
    }
    if (filters.minRating !== undefined) {
        clauses.push("rating >= ?");
        parameters.push(Math.max(0, Math.min(5, filters.minRating)));
    }
    if (filters.minStockQuantity !== undefined) {
        clauses.push("stock_quantity >= ?");
        parameters.push(Math.max(0, Math.trunc(filters.minStockQuantity)));
    }
    if (filters.maxStockQuantity !== undefined) {
        clauses.push("stock_quantity <= ?");
        parameters.push(Math.max(0, Math.trunc(filters.maxStockQuantity)));
    }
    if (filters.inStockOnly) clauses.push("stock_quantity > 0");
    for (const [key, value] of Object.entries(filters.attributes ?? {})) {
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) throw new Error(`Invalid product attribute: ${key}`);
        clauses.push("json_extract(attributes_json, ?) = ?");
        parameters.push(`$.${key}`, value);
    }

    const rows = database
        .query<ProductRow, SqlParameter[]>(
            `SELECT sku, name, description, category, brand, price_cents AS priceCents,
                    stock_quantity AS stockQuantity, rating, attributes_json AS attributesJson
             FROM products WHERE ${clauses.join(" AND ")} ORDER BY rating DESC, price_cents ASC LIMIT 100`,
        )
        .all(...parameters);
    const preferences = filters.preferences?.map((value) => value.trim()).filter(Boolean) ?? [];
    return rows
        .map(({ attributesJson, ...product }) => ({
            ...product,
            attributes: JSON.parse(attributesJson) as ProductSummary["attributes"],
        }))
        .sort((left, right) => {
            const preferenceDifference = preferenceScore(right, preferences) - preferenceScore(left, preferences);
            if (preferenceDifference !== 0) return preferenceDifference;
            if (right.rating !== left.rating) return right.rating - left.rating;
            return left.priceCents - right.priceCents;
        })
        .slice(0, clampInteger(filters.limit, 12, 1, 50));
}
