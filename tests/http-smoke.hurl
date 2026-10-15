GET {{base_url}}/
HTTP 200

GET {{base_url}}/api/health
HTTP 200

# Genuine preflights resolve real resources and intersect their actual methods.
OPTIONS {{base_url}}/does-not-exist
Origin: https://allowed.example
Access-Control-Request-Method: GET
HTTP 404

OPTIONS {{base_url}}/api/health
Origin: https://allowed.example
Access-Control-Request-Method: GET
Access-Control-Request-Headers: Content-Type
HTTP 204
[Asserts]
header "Access-Control-Allow-Methods" == "GET, HEAD, OPTIONS"
header "Access-Control-Allow-Origin" == "https://allowed.example"
header "Vary" contains "Origin"
header "Vary" contains "Access-Control-Request-Method"

OPTIONS {{base_url}}/api/health
Origin: https://allowed.example
Access-Control-Request-Method: DELETE
HTTP 405
[Asserts]
header "Access-Control-Allow-Methods" not exists

OPTIONS {{base_url}}/api/health
Origin: https://denied.example
Access-Control-Request-Method: GET
HTTP 403
[Asserts]
header "Access-Control-Allow-Origin" not exists
header "Vary" contains "Origin"

OPTIONS {{base_url}}/api/health
Origin: https://allowed.example
Access-Control-Request-Method: GET
Access-Control-Request-Headers: X-Not-Allowed
HTTP 403

OPTIONS {{base_url}}/api/cors-options
Origin: https://allowed.example
HTTP 202
[Asserts]
body == "Ordinary OPTIONS"
header "Vary" contains "Accept-Encoding"
header "Vary" contains "Origin"
header "Access-Control-Allow-Methods" not exists

OPTIONS {{base_url}}/api/cors-options
Origin: https://allowed.example
Access-Control-Request-Method: POST
HTTP 204

GET {{base_url}}/api/cors-options
HTTP 200
[Asserts]
jsonpath "$.mutations" == 0
header "Vary" contains "Origin"

OPTIONS {{base_url}}/boundary-safe.txt
Origin: https://allowed.example
Access-Control-Request-Method: HEAD
HTTP 204
[Asserts]
header "Access-Control-Allow-Methods" == "GET, HEAD, OPTIONS"

GET {{base_url}}/api/health
Origin: https://denied.example
HTTP 200
[Asserts]
header "Access-Control-Allow-Origin" not exists
header "Vary" contains "Origin"

GET {{base_url}}/api/version
HTTP 200

GET {{base_url}}/api/users/u42
HTTP 200

GET {{base_url}}/docs/readme
HTTP 200

GET {{base_url}}/docs/architecture
HTTP 200

GET {{base_url}}/api/config
HTTP 200
[Asserts]
jsonpath "$.server.ssl.key" not exists
jsonpath "$.server.ssl.cert" not exists

GET {{base_url}}/does-not-exist
HTTP 404

GET {{base_url}}/%ZZ
HTTP 400

GET {{base_url}}/chat
HTTP 404

POST {{base_url}}/api/chat
Content-Type: application/json
{"input":{"type":"user_text","text":""}}
HTTP 400
[Asserts]
jsonpath "$.message" == "Invalid chat request"

POST {{base_url}}/api/chat
Content-Type: application/json
`not-json`
HTTP 400
[Asserts]
jsonpath "$.message" == "Expected a JSON request body"

POST {{base_url}}/api/actions
Content-Type: application/json
{"actionId":""}
HTTP 400
[Asserts]
jsonpath "$.message" == "Invalid action request"

POST {{base_url}}/api/actions
Content-Type: application/json
`not-json`
HTTP 400
[Asserts]
jsonpath "$.message" == "Expected a JSON request body"

POST {{base_url}}/api/validate/form
HTTP 400

POST {{base_url}}/api/validate/zod
HTTP 400

POST {{base_url}}/api/validate/zod
[FormParams]
email: john.doe@nowhere.local
number: 33611223344
HTTP 200

POST {{base_url}}/api/upload
Content-Type: application/json
{}
HTTP 415
[Asserts]
jsonpath "$.success" == false

POST {{base_url}}/api/upload
Content-Type: multipart/form-data
`malformed`
HTTP 400
[Asserts]
jsonpath "$.success" == false

POST {{base_url}}/api/upload
[MultipartFormData]
file: file,{{upload_fixture}}; application/octet-stream
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.fileName" matches "^uploaded_[0-9a-f-]{36}_upload-fixture.bin$"
jsonpath "$.fileName" not contains ".."
jsonpath "$.fileName" not contains "/"

# Actual file boundary regressions in the isolated application.
GET {{base_url}}/boundary-safe.txt
HTTP 200
[Captures]
asset_etag: header "ETag"
[Asserts]
body == "static boundary fixture"
header "Content-Type" == "text/plain"

HEAD {{base_url}}/boundary-safe.txt
HTTP 200
[Asserts]
body == ""

GET {{base_url}}/boundary-safe.txt
If-None-Match: {{asset_etag}}
HTTP 304

GET {{base_url}}/boundary-safe.txt
Range: bytes=0-5
HTTP 206
[Asserts]
body == "static"

GET {{base_url}}/boundary%20style.css
HTTP 200
[Asserts]
header "Content-Type" == "text/css"

GET {{base_url}}/docs/boundary-safe
HTTP 200
[Asserts]
body contains "Safe boundary documentation"

GET {{base_url}}/boundary-escape.txt
HTTP 404
[Asserts]
body not contains "PRIVATE_BOUNDARY_SENTINEL"

GET {{base_url}}/boundary-sibling.txt
HTTP 404

GET {{base_url}}/boundary-directory/private-fixture.md
HTTP 404

GET {{base_url}}/boundary-folder.txt
HTTP 404

GET {{base_url}}/docs/boundary-escape
HTTP 404
[Asserts]
body not contains "PRIVATE_BOUNDARY_SENTINEL"

GET {{base_url}}/docs/boundary-public
HTTP 404

GET {{base_url}}/docs/boundary-directory/private-fixture
HTTP 404

GET {{base_url}}/docs/boundary-folder
HTTP 404

GET {{base_url}}/%2e%2e%2fprivate-fixture.md
HTTP 404

GET {{base_url}}/boundary-safe%00.txt
HTTP 404

GET {{base_url}}/boundary%2fstyle.css
HTTP 404

GET {{base_url}}/docs/%2e%2e%2fprivate-fixture
HTTP 404

GET {{base_url}}/api/conversations
HTTP 200
[Asserts]
header "Cache-Control" == "no-store"
jsonpath "$.version" == 1

GET {{base_url}}/api/catalog
HTTP 200
[Asserts]
jsonpath "$.version" == 3
jsonpath "$.metrics" count == 8

POST {{base_url}}/api/analysis
Content-Type: application/json
{"conversationId":"http-owned-analysis","requestId":"analysis-first-http","plan":{"metric":"registered_customer_count","dimensions":["region"],"filters":[]}}
HTTP 200
[Captures]
result_id: jsonpath "$.receipt.resultId"
data_revision: jsonpath "$.receipt.datasetRevisionBefore"
[Asserts]
jsonpath "$.receipt.rowCount" == 5
jsonpath "$.receipt.grain" == "customer"
jsonpath "$.receipt.unit" == "count"
jsonpath "$.receipt.datasetRevisionAfter" == "{{data_revision}}"

GET {{base_url}}/api/conversations?conversationId=http-owned-analysis
HTTP 200
[Asserts]
jsonpath "$.head" == "analysis-first-http"
jsonpath "$.events" count == 5
body not contains "provider"

POST {{base_url}}/api/analysis
Content-Type: application/json
{"conversationId":"http-owned-analysis","requestId":"analysis-refine-http","previousResponseId":"analysis-first-http","parentResultId":"{{result_id}}","delta":{"filters":[{"dimension":"region","values":["West"]}]}}
HTTP 200
[Captures]
refined_result_id: jsonpath "$.receipt.resultId"
[Asserts]
jsonpath "$.receipt.parentResultId" == "{{result_id}}"
jsonpath "$.receipt.rowCount" == 1
jsonpath "$.receipt.filters[0].values[0]" == "West"

POST {{base_url}}/api/analysis
Content-Type: application/json
{"conversationId":"http-owned-analysis","requestId":"analysis-refine-http","previousResponseId":"analysis-first-http","parentResultId":"{{result_id}}","delta":{"filters":[{"dimension":"region","values":["West"]}]}}
HTTP 200
[Asserts]
jsonpath "$.replayed" == true

GET {{base_url}}/api/analysis?conversationId=http-owned-analysis&resultId={{refined_result_id}}
HTTP 200
[Asserts]
jsonpath "$.receipt.rowCount" == 1
jsonpath "$.sql" not exists

GET {{base_url}}/api/analysis?conversationId=http-owned-analysis&resultId={{refined_result_id}}&debug=sql
HTTP 200
[Asserts]
jsonpath "$.sql" contains "SELECT"

GET {{base_url}}/api/conversations?conversationId=http-owned-analysis&transport=ag-ui
HTTP 200
[Asserts]
jsonpath "$.adapterVersion" == 1
body contains "RUN_FINISHED"
body not contains "previous_response_id"

POST {{base_url}}/api/datasets/preview
[MultipartFormData]
file: file,monthly-region.csv; text/csv
HTTP 200
[Captures]
preview_id: jsonpath "$.id"
[Asserts]
jsonpath "$.rowCount" == 2
jsonpath "$.status" == "quarantined"
jsonpath "$.executable" == false

GET {{base_url}}/api/datasets/preview?id={{preview_id}}
HTTP 200
[Asserts]
jsonpath "$.rowCount" == 2

POST {{base_url}}/api/analysis
Origin: https://denied.example
Content-Type: application/json
{"conversationId":"http-owned-analysis","requestId":"analysis-origin-denied","plan":{"metric":"registered_customer_count"}}
HTTP 403
