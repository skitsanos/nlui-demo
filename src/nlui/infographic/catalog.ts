import type {FunctionTool} from 'openai/resources/responses/responses';
import {featureEnabled} from '../features.ts';

export const infographicsEnabled = (): boolean => featureEnabled('infographics');
export const INFOGRAPHIC_PROMPT = `
Experimental visual explanations are enabled. Use get_infographic only for an explicit visual explanation of two regions' eligible revenue, one order's recorded history, or the standard return process.
Do not use it for a single number, lists of records, monthly trends, causes, funnels, eligibility decisions or actions. Keep the ordinary scalar/table/chart tools for those questions.
Comparison needs two distinct named regions and an explicit date range. Timeline needs one order number. Process describes general policy, not an order's eligibility or a completed refund.
This tool supplies application-owned blocks and exact scope; select their IDs in the usual strict JSON envelope and add a brief non-duplicative caption. Never generate template syntax, configuration, assets, dates or values.`;

export const INFOGRAPHIC_TOOL: FunctionTool = {
    type: 'function', name: 'get_infographic', strict: true,
    description: 'Experimental read-only visual explanation: comparison of exactly two regions and an explicit period, observed order-event timeline, or general return-policy process. Never use for scalar facts, record lists, trends, causal claims or mutations. The application owns data, labels, templates and fallback.',
    parameters: {
        type: 'object', additionalProperties: false, required: ['view', 'regions', 'from', 'to', 'order_number'],
        properties: {
            view: {type: 'string', enum: ['comparison', 'timeline', 'process']},
            regions: {type: 'array', items: {type: 'string', enum: ['Central', 'East', 'North', 'South', 'West']}, maxItems: 2},
            from: {type: ['string', 'null'], description: 'Explicit comparison start date YYYY-MM-DD; otherwise null.'},
            to: {type: ['string', 'null'], description: 'Explicit comparison end date YYYY-MM-DD; otherwise null.'},
            order_number: {type: ['string', 'null'], description: 'One order for a timeline; otherwise null.'}
        }
    }
};
