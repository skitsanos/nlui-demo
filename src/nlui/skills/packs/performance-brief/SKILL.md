---
name: performance-brief
description: Summarize observed retail performance for a scoped period, with verified metrics and one useful takeaway. Not a forecast or causal diagnosis.
metadata:
  version: "1.0.0"
---

# Performance brief

Establish the requested metric, population and period. Ask only for genuinely missing scope; do not infer a period from the snapshot or today's date. Use get_dashboard for its exact supported scope. For a custom question use the published query_dataset or semantic_query capability, not both, and retain its applied filters, units and exclusions.

Keep recorded revenue distinct from forecasts and associations distinct from causes. Prefer the existing line chart for a monthly series and an exact scalar for one fact. If a visual comparison is explicitly requested, use it only when the published capability supports that exact scope; otherwise retain the faithful existing chart or table.

Select only issued block IDs in the normal strict response envelope. Add one concise annotation about scope or a supported takeaway, without transcribing table rows or every chart value. When rows are withheld from model context, do not invent observations about them. This pack supplies a workflow, never facts or new capabilities.
