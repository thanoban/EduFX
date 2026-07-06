# API Testing Checklist

Use this checklist when validating API endpoints manually, with Postman, or
inside automated tests.

## Status Code Checks

- `200` or `201` for successful requests
- `400` for invalid input
- `401` or `403` for authentication or authorization failures
- `404` for missing resources

## Response Body Checks

- Required keys exist
- Values have correct data types
- IDs, timestamps, and arrays are present in the expected shape
- No internal stack traces or raw server errors are exposed

## Schema Validation

- Response follows the documented JSON schema or OpenAPI contract
- Optional fields appear only when expected
- Enum values match allowed values

## Business Rule Checks

- Totals and scores are logically correct
- Ownership rules are respected
- Returned progress belongs to the active student
- Quiz results align with submitted answers
- Model prediction fields or recommendation outputs are reasonable

## Negative Testing

- Missing required field
- Wrong data type
- Invalid token
- Invalid resource ID
- Unsupported HTTP method
- Invalid content type

## Performance Smoke

- Response time stays below a simple threshold such as `1000 ms` for small APIs
- Threshold may be adjusted for real network conditions and cold starts

## Security Basics

- No secrets are exposed
- No stack traces leak into client responses
- No access to another user’s data
- Test only legal demo, local, or approved staging systems
