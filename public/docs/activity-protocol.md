# Public activity and chat protocol

`POST /api/chat` validates the request before opening an `application/x-ndjson; charset=utf-8` response. It is newline-delimited JSON, **not SSE**: each nonempty line is one JSON object with a `type` discriminant. A network chunk may contain part of a line or several lines. Client cancellation aborts the request; EOF alone never means success.

## Public events

| Type | Public fields | Meaning |
| --- | --- | --- |
| `message.started` | `messageId` | Application message identity. |
| `activity.updated` | `activity` | Replace/upsert the application-owned activity with the same ID. |
| `text.delta` | `delta` | Append validated user-facing text. Structured JSON is never streamed as prose. |
| `ui.block` | `block` | A validated server-owned NLUI block, not executable model-authored UI. |
| `message.completed` | `messageId`, `responseId` | Terminal success; `responseId` is an application turn cursor, not a provider ID. |
| `error` | `message` | A sanitized configuration, cancellation, timeout or generic error. Not success. |

`activity` contains exactly `id`, `kind`, `title`, optional `description`, `status`, and `receipt`. Kinds are `request`, `data`, `action`, and `compose`. Statuses are `loading`, `success`, `error`, and `abort`. Labels come from the server's fixed catalog: they describe observable operations, **not hidden reasoning or chain of thought**. `receipt: true` makes a completed operation eligible for the selective receipt view; it does not grant authority to act.

Activities may update before final text is available. The controller buffers its structured response until the provider completes and the envelope/block selection validates; it then publishes the annotation and selected UI. A partial stream/error must not commit provisional content as a completed turn. The client maintains one active activity indicator and a selective completed receipt list, not every transient event as permanent prose.

## Safe examples

These application-authored activity records contain no tool arguments, query text, result rows, model IDs or reasoning. Repeated IDs update one activity rather than create duplicates.

```ndjson
{"type":"activity.updated","activity":{"id":"message-example:tool:1","kind":"data","title":"Checking the demo dataset","description":"Running a bounded read-only data lookup.","status":"loading","receipt":true}}
{"type":"activity.updated","activity":{"id":"message-example:tool:1","kind":"data","title":"Checking the demo dataset","description":"Running a bounded read-only data lookup.","status":"success","receipt":true}}
```

## Internal evidence and compatibility boundary

`tool.started` and `tool.completed` are internal controller/evaluation events and are filtered out by `publicChatStreamEvent`. Provider events, tool call IDs/arguments/results, query/plan debug evidence, token accounting and model metadata are not public activity fields. Browser activity records are application-authored progress, not an audit log, provider trace or proof of authorization.

The HTTP route owns continuation: the client sends a stable `requestId`, application `conversationId` and optional `previousResponseId` matching the last committed application turn. The legacy field name remains, but no provider response ID crosses this route. Repeated identical requests replay persisted events; changed input or a stale head fails without repeating work. The cursor is not a principal, session token or action capability. An isolated evaluation adapter still exercises provider-managed chaining internally.

`GET /api/conversations?conversationId=…&after=0` returns owner-scoped ordered events, sequence cursors, interruption state and current control lifecycle. Persisted `user.input` records are replay data, not extra live NDJSON event types. Continue with `nextCursor` while `hasMore` is true. An HttpOnly anonymous-session cookie is required; another session receives 404. The versioned SQLite log persists safe public events, not raw provider reasoning or tool envelopes. Refresh reconstructs UI without re-running tools or confirmations.

`transport=ag-ui` selects a bounded JSON replay projection with run/text events and named custom activity/block events. It is not SSE or complete AG-UI event-family conformance. Domain blocks and capabilities remain independent of that adapter.

Only the server capability registry resolves typed `ui_result` values and action confirmations. A completion event, receipt, repeated block ID or replayed activity never authorizes or re-executes a mutation. See [architecture](/docs/architecture) for the controlled UI and evaluation boundaries.
