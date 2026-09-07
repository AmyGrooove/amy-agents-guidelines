# Backend Contracts

Return a successful response DTO directly, without a universal `data` wrapper. A paginated endpoint uses an explicit response DTO whose pagination fields belong to that endpoint contract.

Return failures as:

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "User-appropriate message",
    "details": null,
    "traceId": "correlation-id"
  }
}
```

Keep `code` stable and machine-readable, `message` appropriate for the user, `details` structured context or `null`, and `traceId` suitable for server-diagnostic correlation. Preserve domain or framework errors that already express the failure. Map errors only at an explicit boundary and preserve the cause.

The frontend shared typed API error mirrors the contract: HTTP status plus `code`, `message`, `details`, and `traceId` when available. Frontend request objects reject on non-success so TanStack Query receives errors naturally. A `204` yields `undefined` only under a declared `void` or `undefined` response contract.
