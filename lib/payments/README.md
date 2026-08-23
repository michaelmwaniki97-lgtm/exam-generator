# Payment provider handover

Phase 11A deliberately contains no Daraja wire contract or credentials. Phase 11B must use the current authenticated Safaricom documentation.

Production handover checklist:

1. The client creates and owns its Safaricom Daraja application and business integration.
2. Obtain the current required sandbox credentials from Safaricom.
3. Configure those credentials only in the hosting platform's server environment.
4. Configure the client's public application and callback domain server-side.
5. Validate the sandbox OAuth, initiation, callback, and query flows.
6. Complete Safaricom's current production/go-live requirements.
7. Install the separate production credential set and explicitly select production.
8. Perform one controlled production payment test.

Production must fail closed when any credential is absent. Sandbox and production credentials must remain separate. No credential belongs in source code, `NEXT_PUBLIC_` variables, browser storage, application settings, or Git.
