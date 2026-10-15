import {type FormInputValues, normalizeFormValues} from '../nlui/formValues.ts';
import {fieldRule} from '../nlui/interactionCapabilityTypes.ts';
import type {FormBlock} from '../nlui/types.ts';
import type {ContinueInteraction} from './confirmationController.ts';

export type FormSubmissionState = 'idle' | 'submitting' | 'submitted' | 'error';

export class FormSubmissionController
{
    private state: FormSubmissionState = 'idle';
    private readonly listeners = new Set<() => void>();
    private readonly fields;
    private generation = 0;

    constructor(private readonly block: FormBlock)
    {
        this.fields = new Map(block.fields.map((field) => [field.name, fieldRule(field)]));
    }

    getSnapshot = (): FormSubmissionState => this.state;
    subscribe = (listener: () => void): (() => void) =>
    {
        this.listeners.add(listener);
        return () => {this.listeners.delete(listener);};
    };
    private update(state: FormSubmissionState): void
    {
        this.state = state;
        for (const listener of this.listeners) listener();
    }

    submit = async (values: FormInputValues, onInteraction: ContinueInteraction): Promise<void> =>
    {
        if (this.state === 'submitting' || this.state === 'submitted') return;
        const generation = this.generation;
        this.update('submitting');
        let completed = false;
        try
        {
            completed = await onInteraction({type: 'ui_result', interactionId: this.block.interactionId,
                values: normalizeFormValues(this.fields, values)}, `Submitted ${this.block.title ?? 'the requested details'}`);
        }
        catch { /* Preserve editable form values without exposing transport/provider diagnostics. */ }
        if (generation === this.generation) this.update(completed ? 'submitted' : 'error');
    };

    cancelPending = (): void =>
    {
        this.generation += 1;
        if (this.state === 'submitting') this.update('error');
    };
}
