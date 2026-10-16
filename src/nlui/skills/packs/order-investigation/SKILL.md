---
name: order-investigation
description: Investigate one supplied order's recorded status and shipment history. Not an action request, refund decision or delivery guarantee.
metadata:
  version: "1.0.0"
---

# Order investigation

Use the order number already supplied; clarify it only when absent or ambiguous. Retrieve the order with get_order intent lookup. A completed lookup reporting absence establishes only that the record was not found in this snapshot, not invented history or zero sales. If no UI block is issued, use the normal message response; never invent a result block to satisfy a preferred layout.

Separate recorded creation, payment, dispatch and delivery timestamps from expected delivery forecasts and unrecorded milestones. A sequence does not imply elapsed-time geometry or an explanation of why a delay happened. Request a recorded timeline only if the user asks for it and the tool is published; otherwise keep exact order details or a table.

Retain sources, scope and UTC date semantics. Use the ordinary strict response envelope and a short non-duplicative annotation. Investigation alone is not permission to cancel, return, change an address or approve a refund. A fresh explicit user request and the existing prepare/confirm boundaries are still required for any subsequent mutation.
