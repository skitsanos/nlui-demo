import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const TOOL_NAMES = [
    "confirm_action",
    "get_dashboard",
    "get_order",
    "list_orders",
    "prepare_action",
    "query_dataset",
    "search_policies",
    "search_products",
] as const;

const BLOCK_NAMES = [
    "action_result",
    "chart",
    "choice",
    "citations",
    "confirmation",
    "error",
    "form",
    "markdown",
    "metrics",
    "table",
] as const;

const toolNameSchema = z.enum(TOOL_NAMES);
const blockNameSchema = z.enum(BLOCK_NAMES);
const uniqueArray = <T extends z.ZodType>(schema: T) =>
    z.array(schema).refine((items) => new Set(items).size === items.length, "Values must be unique");

const pendingActionSchema = z.discriminatedUnion("type", [
    z
        .object({
            type: z.literal("return_order"),
            orderNumber: z.string().regex(/^ORD-\d+$/),
            reason: z.string().min(3),
        })
        .strict(),
    z
        .object({
            type: z.literal("cancel_order"),
            orderNumber: z.string().regex(/^ORD-\d+$/),
            reason: z.string().min(3),
        })
        .strict(),
    z
        .object({
            type: z.literal("update_shipping_address"),
            orderNumber: z.string().regex(/^ORD-\d+$/),
            address: z
                .object({
                    line1: z.string().min(3),
                    city: z.string().min(2),
                    postalCode: z.string().min(3),
                    country: z.string().min(2),
                })
                .strict(),
        })
        .strict(),
]);

const scenarioSchema = z
    .object({
        id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        category: z.enum(["analytics", "disambiguation", "orders", "products", "retrieval", "safe-action"]),
        prompt: z.string().trim().min(1).max(500),
        setup: z.object({ pendingAction: pendingActionSchema }).strict().optional(),
        expectedTools: uniqueArray(toolNameSchema),
        expectedBlocks: uniqueArray(blockNameSchema).refine((blocks) => blocks.length > 0, "At least one block is required"),
        mustNotInvoke: uniqueArray(toolNameSchema),
        dataAssertions: uniqueArray(z.string().trim().min(1)).refine(
            (assertions) => assertions.length > 0,
            "At least one data assertion is required",
        ),
    })
    .strict();

type Scenario = z.infer<typeof scenarioSchema>;

function loadScenarios(): Scenario[] {
    const scenarioPath = join(process.cwd(), "data", "scenarios.jsonl");
    const source = readFileSync(scenarioPath, "utf8").trim();
    const lines = source.split(/\r?\n/);
    expect(lines.every((line) => line.trim().length > 0)).toBeTrue();
    return lines.map((line, index) => {
        try {
            return scenarioSchema.parse(JSON.parse(line) as unknown);
        } catch (error) {
            throw new Error(`Invalid scenario on line ${index + 1}`, { cause: error });
        }
    });
}

describe("golden NLUI scenarios", () => {
    test("every JSONL record satisfies the strict fixture contract", () => {
        const scenarios = loadScenarios();
        expect(scenarios).toHaveLength(33);
        expect(new Set(scenarios.map(({ id }) => id)).size).toBe(scenarios.length);

        const usedTools = scenarios.flatMap(({ expectedTools, mustNotInvoke }) => [...expectedTools, ...mustNotInvoke]);
        const usedBlocks = scenarios.flatMap(({ expectedBlocks }) => expectedBlocks);
        expect(usedTools.every((tool) => TOOL_NAMES.includes(tool))).toBeTrue();
        expect(usedBlocks.every((block) => BLOCK_NAMES.includes(block))).toBeTrue();
    });

    test("covers the required render, retrieval, and safe-action concepts", () => {
        const scenarios = loadScenarios();
        const expectedBlocks = new Set(scenarios.flatMap(({ expectedBlocks: blocks }) => blocks));
        for (const requiredBlock of ["chart", "table", "choice", "form", "confirmation", "action_result"] as const) {
            expect(expectedBlocks.has(requiredBlock)).toBeTrue();
        }

        expect(
            scenarios.some(
                (scenario) =>
                    scenario.category === "retrieval" &&
                    scenario.expectedTools.includes("search_policies") &&
                    scenario.expectedBlocks.includes("citations"),
            ),
        ).toBeTrue();
        expect(
            scenarios.some(
                (scenario) =>
                    scenario.category === "safe-action" &&
                    scenario.expectedTools.includes("confirm_action") &&
                    scenario.expectedBlocks.includes("action_result"),
            ),
        ).toBeTrue();
        expect(
            scenarios.some(
                (scenario) =>
                    scenario.expectedBlocks.includes("confirmation") && scenario.mustNotInvoke.includes("confirm_action"),
            ),
        ).toBeTrue();
        expect(
            scenarios.some(({ mustNotInvoke }) =>
                mustNotInvoke.some((tool) => tool === "prepare_action" || tool === "confirm_action"),
            ),
        ).toBeTrue();
    });
});
