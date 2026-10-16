// Server-owned opt-ins. HTTP input never sets feature configuration.
export const EXPERIMENT_FLAGS = {infographics: 'NLUI_INFOGRAPHICS', skills: 'NLUI_SKILLS'} as const;
export const featureEnabled = (feature: keyof typeof EXPERIMENT_FLAGS, environment: Record<string, string | undefined> = process.env): boolean =>
    environment[EXPERIMENT_FLAGS[feature]] === '1';
