import type {QueryWorkerRequest} from './queryTypes.ts';
import {executeWorkerQuery} from './queryWorkerExecution.ts';

self.onmessage = (event: MessageEvent<QueryWorkerRequest>): void =>
{
    postMessage(executeWorkerQuery(event.data));
};
