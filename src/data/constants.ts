import { join } from "node:path";

export const DATASET_VERSION = 1;
export const DATASET_SEED = 0x4e4c5549;
export const DATASET_ID = "nlui-retail-operations-v1";
export const DATASET_REFERENCE_DATE = "2026-06-30T12:00:00.000Z";

export const DEFAULT_DATA_DIRECTORY = join(process.cwd(), "data");
export const DEFAULT_DATABASE_PATH = join(DEFAULT_DATA_DIRECTORY, "demo.sqlite");
export const DEFAULT_KNOWLEDGE_PATH = join(DEFAULT_DATA_DIRECTORY, "knowledge");

export const EXPECTED_COUNTS = {
    customers: 200,
    orders: 1_500,
    products: 100,
} as const;
