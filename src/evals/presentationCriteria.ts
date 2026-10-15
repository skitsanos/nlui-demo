import type {FormField} from '../nlui/types.ts';

// Frozen expectations, deliberately independent of the production form factory and formatter.
// A wording/units change must update these criteria and its evidence, not grade itself.
export const PRODUCT_FACT_CRITERIA = {
    batteryHours: {label: 'Battery life', unit: 'hours'}, weightKg: {label: 'Weight', unit: 'kg'},
    ramGb: {label: 'RAM', unit: 'GB'}, storageGb: {label: 'Storage', unit: 'GB'}, resolution: {label: 'Resolution', unit: ''}
} as const;

export const FORM_QUESTION_CRITERIA: Record<'office_questions' | 'order_questions', FormField[]> = {
    office_questions: [
        {name: 'maximum_price_eur', label: 'Maximum price (€)', input: 'number', min: 1},
        {name: 'desk_requirements', label: 'Desk space and accessibility needs', input: 'textarea', maxLength: 300,
            help: 'How much desk space is available? Include any accessibility or positioning needs.'},
        {name: 'device_requirements', label: 'Devices and connections', input: 'textarea', maxLength: 300,
            help: 'Which devices will you use, and which ports or connections do they need?'}
    ],
    order_questions: [
        {name: 'order_number', label: 'Order number', input: 'text', required: true, placeholder: 'ORD-1042'},
        {name: 'intended_outcome', label: 'What would you like to do?', input: 'select', required: true, options: [
            {label: 'Track delivery', value: 'track'}, {label: 'Change shipping address', value: 'change_address'},
            {label: 'Request a return', value: 'return'}, {label: 'Cancel the order', value: 'cancel'},
            {label: 'Something else', value: 'other'}]}
    ]
};
