# Payment provider handover

Phase 11B implements the verified Daraja M-Pesa Express contract. Credentials remain client-owned, server-only deployment configuration and are never application settings.

Required server environment:

- `PAYMENT_PROVIDER=daraja`
- `MPESA_ENVIRONMENT=sandbox` or `production`
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_BUSINESS_SHORTCODE`
- `MPESA_PARTY_B`
- `MPESA_PASSKEY`
- `MPESA_TRANSACTION_TYPE=CustomerPayBillOnline` or `CustomerBuyGoodsOnline`
- `PUBLIC_APP_URL` (the client's HTTPS application origin)
- `MPESA_QUERY_URL` in production only, because the production query endpoint was not present in the supplied verified documentation

Incomplete or mixed configuration fails closed. There is no fake, sandbox, or developer-account fallback in production.

Production handover checklist:

1. The client creates and owns its Safaricom Daraja application and business integration.
2. Obtain the current required sandbox credentials from Safaricom.
3. Configure the variables above only in the hosting platform's server environment.
4. Configure the client's public application and callback domain server-side.
5. Validate the sandbox OAuth, initiation, callback, and query flows.
6. Complete Safaricom's current production/go-live requirements.
7. Install the separate production credential set and explicitly select production.
8. Perform one controlled production payment test.

Production must fail closed when any credential is absent. Sandbox and production credentials must remain separate. No credential belongs in source code, `NEXT_PUBLIC_` variables, browser storage, application settings, or Git.
