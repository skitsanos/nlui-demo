GET {{base_url}}/
HTTP 200

GET {{base_url}}/api/health
HTTP 200

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
