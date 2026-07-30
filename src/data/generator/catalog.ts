import { DATASET_REFERENCE_DATE } from "../constants.ts";
import type { CustomerRegion } from "../types.ts";
import { addDays, type SeededRandom } from "./random.ts";
import type { CustomerSeed, ProductSeed } from "./types.ts";

const FIRST_NAMES = [
    "Alex",
    "Maya",
    "Noah",
    "Sofia",
    "Liam",
    "Emma",
    "Mateo",
    "Elena",
    "Lucas",
    "Amara",
    "Theo",
    "Nora",
    "Leo",
    "Mila",
    "Daniel",
    "Zoe",
    "Adrian",
    "Iris",
    "Jonas",
    "Clara",
] as const;

const LAST_NAMES = [
    "Morgan",
    "Ionescu",
    "Rossi",
    "Kowalski",
    "Novak",
    "Martin",
    "Popescu",
    "Santos",
    "Weber",
    "Nielsen",
    "Petrescu",
    "Dubois",
    "Ivanov",
    "Bauer",
    "Costa",
    "Marin",
    "Schmidt",
    "Varga",
    "Andersson",
    "Muller",
] as const;

const LOCATIONS: ReadonlyArray<{
    region: CustomerRegion;
    city: string;
    country: string;
    postalPrefix: string;
}> = [
    { region: "Central", city: "Vienna", country: "Austria", postalPrefix: "10" },
    { region: "Central", city: "Prague", country: "Czechia", postalPrefix: "11" },
    { region: "East", city: "Bucharest", country: "Romania", postalPrefix: "01" },
    { region: "East", city: "Warsaw", country: "Poland", postalPrefix: "00" },
    { region: "North", city: "Stockholm", country: "Sweden", postalPrefix: "11" },
    { region: "North", city: "Copenhagen", country: "Denmark", postalPrefix: "10" },
    { region: "South", city: "Milan", country: "Italy", postalPrefix: "20" },
    { region: "South", city: "Barcelona", country: "Spain", postalPrefix: "08" },
    { region: "West", city: "Paris", country: "France", postalPrefix: "75" },
    { region: "West", city: "Amsterdam", country: "Netherlands", postalPrefix: "10" },
] as const;

interface ProductSpec {
    category: string;
    brands: readonly string[];
    series: readonly string[];
    priceRange: readonly [number, number];
    useCases: readonly string[];
    attributes: (index: number, random: SeededRandom) => Record<string, string | number | boolean>;
}

const PRODUCT_SPECS: readonly ProductSpec[] = [
    {
        category: "Laptops",
        brands: ["Aurora", "Vertex", "Northstar", "Terra"],
        series: ["Air", "Pro", "Studio", "Flex", "Edge"],
        priceRange: [69_900, 229_900],
        useCases: ["travel", "software development", "creative work", "business", "gaming"],
        attributes: (index) => ({
            batteryHours: 8 + (index % 5) * 2,
            processor: ["Core Ultra 5", "Core Ultra 7", "Ryzen 7", "Ryzen 9"][index % 4]!,
            ramGb: [8, 16, 16, 32, 32][index % 5]!,
            screenInches: [13.3, 14, 15.6, 16][index % 4]!,
            storageGb: [512, 512, 1_024, 2_048][index % 4]!,
            weightKg: Number((1.18 + (index % 5) * 0.22).toFixed(2)),
        }),
    },
    {
        category: "Monitors",
        brands: ["PixelPeak", "Vertex", "Northstar"],
        series: ["View", "Canvas", "Ultra", "Color", "Wide"],
        priceRange: [18_900, 119_900],
        useCases: ["home office", "design", "gaming", "data analysis"],
        attributes: (index) => ({
            panel: ["IPS", "OLED", "VA"][index % 3]!,
            refreshHz: [60, 75, 120, 144, 165][index % 5]!,
            resolution: ["1920x1080", "2560x1440", "3440x1440", "3840x2160"][index % 4]!,
            screenInches: [24, 27, 32, 34][index % 4]!,
        }),
    },
    {
        category: "Audio",
        brands: ["EchoWorks", "SonicField", "Aurora"],
        series: ["Pulse", "Quiet", "Studio", "Wave", "Air"],
        priceRange: [4_900, 49_900],
        useCases: ["calls", "music", "travel", "studio monitoring"],
        attributes: (index) => ({
            batteryHours: 16 + (index % 5) * 8,
            noiseCancelling: index % 3 !== 0,
            wireless: index % 4 !== 0,
        }),
    },
    {
        category: "Keyboards",
        brands: ["KeyCraft", "Vertex", "Terra"],
        series: ["Type", "Mech", "Flow", "Mini", "Ergo"],
        priceRange: [3_900, 24_900],
        useCases: ["writing", "gaming", "ergonomics", "travel"],
        attributes: (index) => ({
            backlit: index % 2 === 0,
            layout: ["ISO", "ANSI"][index % 2]!,
            switchType: ["membrane", "linear", "tactile", "low-profile"][index % 4]!,
            wireless: index % 3 !== 0,
        }),
    },
    {
        category: "Mice",
        brands: ["SwiftPoint", "KeyCraft", "Vertex"],
        series: ["Glide", "Ergo", "Precision", "Travel", "Pro"],
        priceRange: [2_900, 17_900],
        useCases: ["office", "gaming", "travel", "design"],
        attributes: (index) => ({
            buttons: 3 + (index % 5) * 2,
            dpi: [1_600, 3_200, 8_000, 16_000][index % 4]!,
            ergonomic: index % 3 === 0,
            wireless: index % 4 !== 0,
        }),
    },
    {
        category: "Mobile",
        brands: ["Aurora", "Northstar", "Terra"],
        series: ["One", "Plus", "Pro", "Mini", "Max"],
        priceRange: [29_900, 139_900],
        useCases: ["photography", "business", "everyday", "travel"],
        attributes: (index) => ({
            cameraMp: [24, 48, 50, 108][index % 4]!,
            storageGb: [128, 256, 512][index % 3]!,
            waterproof: index % 3 !== 0,
        }),
    },
    {
        category: "Tablets",
        brands: ["Canvas", "Aurora", "Vertex"],
        series: ["Sketch", "Tab", "Paper", "Studio", "Go"],
        priceRange: [19_900, 99_900],
        useCases: ["drawing", "reading", "travel", "presentations"],
        attributes: (index) => ({
            penIncluded: index % 2 === 0,
            screenInches: [8.7, 10.9, 11, 12.9][index % 4]!,
            storageGb: [64, 128, 256, 512][index % 4]!,
        }),
    },
    {
        category: "Storage",
        brands: ["DataDock", "Northstar", "Vertex"],
        series: ["Vault", "Flash", "Archive", "Pocket", "Pro"],
        priceRange: [3_900, 79_900],
        useCases: ["backup", "video editing", "portable storage", "archive"],
        attributes: (index) => ({
            capacityGb: [500, 1_000, 2_000, 4_000, 8_000][index % 5]!,
            interface: ["USB-C", "Thunderbolt 4", "USB-A", "NVMe"][index % 4]!,
            portable: index % 4 !== 3,
        }),
    },
    {
        category: "Networking",
        brands: ["Meshline", "DataDock", "Terra"],
        series: ["Connect", "Mesh", "Range", "Office", "Secure"],
        priceRange: [4_900, 59_900],
        useCases: ["home", "small business", "travel", "large spaces"],
        attributes: (index) => ({
            maxMbps: [1_200, 2_400, 4_800, 6_000][index % 4]!,
            meshReady: index % 3 !== 0,
            wifiStandard: ["Wi-Fi 5", "Wi-Fi 6", "Wi-Fi 6E", "Wi-Fi 7"][index % 4]!,
        }),
    },
    {
        category: "Office",
        brands: ["WorkForm", "Terra", "KeyCraft"],
        series: ["Stand", "Light", "Dock", "Hub", "Ergo"],
        priceRange: [2_500, 64_900],
        useCases: ["ergonomics", "hybrid work", "organization", "video calls"],
        attributes: (index, random) => ({
            adjustable: index % 3 !== 0,
            color: random.pick(["graphite", "silver", "white", "navy"]),
            warrantyYears: 2 + (index % 3),
        }),
    },
] as const;

export function generateCustomers(random: SeededRandom): CustomerSeed[] {
    return Array.from({ length: 200 }, (_, index) => {
        const id = index + 1;
        const location = LOCATIONS[index % LOCATIONS.length]!;
        const firstName = id === 42 ? "Alex" : FIRST_NAMES[(index * 7) % FIRST_NAMES.length]!;
        const lastName = id === 42 ? "Morgan" : LAST_NAMES[(index * 11 + 3) % LAST_NAMES.length]!;
        const joinedDaysAgo = random.integer(190, 1_300);
        return {
            id,
            customerNumber: `CUS-${String(id).padStart(4, "0")}`,
            firstName,
            lastName,
            email: `${firstName}.${lastName}.${id}@example.test`.toLowerCase(),
            phone: `+40-700-${String(10_000 + id).slice(-5)}`,
            region: location.region,
            city: location.city,
            country: location.country,
            tier: id % 10 === 0 ? "gold" : id % 4 === 0 ? "silver" : "standard",
            joinedAt: addDays(DATASET_REFERENCE_DATE, -joinedDaysAgo),
        };
    });
}

export function generateProducts(random: SeededRandom): ProductSeed[] {
    return PRODUCT_SPECS.flatMap((spec, specIndex) =>
        Array.from({ length: 10 }, (_, localIndex) => {
            const id = specIndex * 10 + localIndex + 1;
            const brand = spec.brands[localIndex % spec.brands.length]!;
            const series = spec.series[localIndex % spec.series.length]!;
            const useCase = spec.useCases[localIndex % spec.useCases.length]!;
            const [minimum, maximum] = spec.priceRange;
            const rawPrice = random.integer(minimum / 100, maximum / 100) * 100;
            const attributes = { ...spec.attributes(localIndex, random), useCase };
            return {
                id,
                sku: `SKU-${String(id).padStart(4, "0")}`,
                name: `${brand} ${series} ${localIndex + 1}`,
                description: `A ${spec.category.toLowerCase()} option designed for ${useCase}.`,
                category: spec.category,
                brand,
                priceCents: rawPrice,
                stockQuantity: id % 17 === 0 ? random.integer(0, 3) : random.integer(8, 140),
                rating: Number((3.5 + random.next() * 1.5).toFixed(1)),
                active: 1,
                attributes,
            };
        }),
    );
}

export function customerLocation(customer: CustomerSeed): {
    line1: string;
    city: string;
    postalCode: string;
    country: string;
} {
    const location = LOCATIONS.find((entry) => entry.city === customer.city)!;
    return {
        line1: `${20 + (customer.id % 170)} Market Street`,
        city: customer.city,
        postalCode: `${location.postalPrefix}${String(100 + customer.id).padStart(3, "0")}`,
        country: customer.country,
    };
}
