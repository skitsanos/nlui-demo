import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDemoRepository, DEFAULT_KNOWLEDGE_PATH, resetDemoDatabase } from "./index.ts";

const temporaryDirectories: string[] = [];

function temporaryDatabase(): string {
    const directory = mkdtempSync(join(tmpdir(), "nlui-data-test-"));
    temporaryDirectories.push(directory);
    return join(directory, "demo.sqlite");
}

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
        rmSync(directory, { force: true, recursive: true });
    }
});

describe("deterministic demo dataset", () => {
    test("seeds stable counts and repeatable query results", () => {
        const firstPath = temporaryDatabase();
        const secondPath = temporaryDatabase();
        const firstSummary = resetDemoDatabase({ databasePath: firstPath, knowledgePath: DEFAULT_KNOWLEDGE_PATH });
        const secondSummary = resetDemoDatabase({ databasePath: secondPath, knowledgePath: DEFAULT_KNOWLEDGE_PATH });
        expect(firstSummary).toEqual(secondSummary);
        expect(firstSummary).toMatchObject({ customers: 200, products: 100, orders: 1_500, policyDocuments: 4 });

        const first = createDemoRepository({ databasePath: firstPath });
        const second = createDemoRepository({ databasePath: secondPath });
        try {
            expect(first.getDashboard()).toEqual(second.getDashboard());
            expect(first.getOrder(1042)).toEqual(second.getOrder("ORD-1042"));
            expect(first.searchProducts({ category: "Laptops", limit: 5 })).toEqual(
                second.searchProducts({ category: "Laptops", limit: 5 }),
            );
        } finally {
            first.close();
            second.close();
        }
    });

    test("supports bounded order and product filters", () => {
        const databasePath = temporaryDatabase();
        resetDemoDatabase({ databasePath });
        const repository = createDemoRepository({ databasePath });
        try {
            const orders = repository.listOrders({
                statuses: ["delayed"],
                minTotalCents: 50_000,
                sort: "total_desc",
                limit: 200,
            });
            expect(orders.limit).toBe(100);
            expect(orders.items.length).toBeGreaterThan(0);
            expect(orders.items.every((order) => order.status === "delayed" && order.totalCents >= 50_000)).toBeTrue();

            const products = repository.searchProducts({
                category: "Audio",
                inStockOnly: true,
                attributes: { noiseCancelling: true, wireless: true },
            });
            expect(products.length).toBeGreaterThan(0);
            expect(products.every((product) => product.attributes.noiseCancelling && product.attributes.wireless)).toBeTrue();
        } finally {
            repository.close();
        }
    });

    test("retrieves grounded policy sections", () => {
        const databasePath = temporaryDatabase();
        resetDemoDatabase({ databasePath });
        const repository = createDemoRepository({ databasePath });
        try {
            const matches = repository.searchPolicies("return window and refund timing", 3);
            expect(matches[0]?.documentId).toBe("returns-policy");
            expect(matches.some((match) => match.excerpt.includes("30 calendar days"))).toBeTrue();
            expect(matches.every((match) => match.sourcePath.startsWith("knowledge/"))).toBeTrue();
        } finally {
            repository.close();
        }
    });

    test("requires confirmation before a mutation", () => {
        const databasePath = temporaryDatabase();
        resetDemoDatabase({ databasePath });
        const repository = createDemoRepository({ databasePath });
        try {
            const before = repository.getOrder(1176);
            const superseded = repository.prepareAction({
                type: "update_shipping_address",
                orderNumber: "1176",
                address: { line1: "20 Old Avenue", city: "Prague", postalCode: "11000", country: "Czechia" },
            });
            const confirmation = repository.prepareAction({
                type: "update_shipping_address",
                orderNumber: "1176",
                address: { line1: "10 Demo Avenue", city: "Bucharest", postalCode: "010101", country: "Romania" },
            });
            expect(repository.getOrder(1176)?.shippingAddress).toEqual(before?.shippingAddress);
            expect(confirmation.actionType).toBe("update_shipping_address");
            expect(() => repository.confirmAction(superseded.actionId)).toThrow("no longer pending");

            const result = repository.confirmAction(confirmation.actionId);
            expect(result.status).toBe("completed");
            expect(repository.getOrder(1176)?.shippingAddress).toEqual({
                line1: "10 Demo Avenue",
                city: "Bucharest",
                postalCode: "010101",
                country: "Romania",
            });
        } finally {
            repository.close();
        }
    });

    test("keeps golden scenarios parseable and complete", () => {
        const scenarioPath = join(process.cwd(), "data", "scenarios.jsonl");
        const scenarios = readFileSync(scenarioPath, "utf8")
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line) as Record<string, unknown>);
        expect(scenarios).toHaveLength(33);
        expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(33);
        expect(scenarios.every((scenario) => Array.isArray(scenario.expectedBlocks))).toBeTrue();
        expect(scenarios.every((scenario) => Array.isArray(scenario.mustNotInvoke))).toBeTrue();
    });
});
