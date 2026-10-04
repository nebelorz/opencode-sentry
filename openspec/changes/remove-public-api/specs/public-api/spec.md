## REMOVED Requirements

### Requirement: Current snapshot is exposed over HTTP

**Reason**: The HTTP API is not implemented or deployed; the snapshot is consumed from committed JSON over raw GitHub.
**Migration**: Read `data/latest.json` and fetch the referenced snapshot from the raw GitHub URL.

### Requirement: Latest change report is exposed over HTTP

**Reason**: The HTTP API is not implemented or deployed; the change report is consumed from committed JSON over raw GitHub.
**Migration**: Read `data/latest.json` and fetch the referenced change report from the raw GitHub URL.

### Requirement: The API is read-only

**Reason**: There is no HTTP API to constrain.
**Migration**: None; no endpoint exists.

### Requirement: Latest data is resolved without scanning or diffing

**Reason**: Latest-data resolution now happens when generating `data/latest.json`, not at request time.
**Migration**: Use the `latest-pointer` capability.

### Requirement: The Worker performs no scraping, parsing, or diff logic

**Reason**: The Worker is removed.
**Migration**: None; no Worker exists.

### Requirement: The data source is the generated project data

**Reason**: There is no HTTP API to serve the data.
**Migration**: The skill reads the generated project data directly.

### Requirement: Successful responses return HTTP 200

**Reason**: There are no HTTP responses.
**Migration**: None; no endpoint exists.

### Requirement: Unavailable data returns a 5xx response

**Reason**: There are no HTTP responses.
**Migration**: The pointer command fails loudly when data is unavailable.

### Requirement: Invalid stored data returns a 5xx response

**Reason**: There are no HTTP responses.
**Migration**: The pointer command fails loudly when data is invalid.

### Requirement: Stored data is validated before being returned

**Reason**: Validation now happens when generating the pointer, not when serving a response.
**Migration**: Use the `latest-pointer` capability, which validates the newest snapshot and change report.

### Requirement: Existing schemas are reused, not duplicated

**Reason**: There is no API schema layer.
**Migration**: None; the pointer command reuses the existing schemas.

### Requirement: Error responses use a consistent JSON shape

**Reason**: There are no HTTP error responses.
**Migration**: The pointer command reports errors on stderr with a non-zero exit status.

### Requirement: Error responses do not leak internal details

**Reason**: There are no HTTP error responses.
**Migration**: None; no endpoint exists.

### Requirement: Caching headers are set on read endpoints

**Reason**: There are no read endpoints.
**Migration**: None; raw GitHub handles HTTP caching.

### Requirement: A minimal health endpoint is provided

**Reason**: There is no running service to health-check.
**Migration**: None; no endpoint exists.

### Requirement: API tests are deterministic and offline

**Reason**: There are no API tests because the API is removed.
**Migration**: Pointer tests replace them.
