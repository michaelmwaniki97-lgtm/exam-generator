# Self-Hosted Database Abstraction — RPC Foundation

Status: RPC foundation, CRUD Phases 1-10C, and Write Phases 1-5 are checkpointed; the textbook Storage/ingestion boundary migration is under review and uncommitted. Production behavior still defaults to Supabase. Authentication, production data, Daraja, and deployment are unchanged.

## Textbook Storage and ingestion boundary

This slice moves the two deferred private-document reads, all nine direct textbook/document/chunk writes, and the four operational Storage paths behind two narrow server-only boundaries. `lib/textbook-workflow` owns textbook creation, document metadata creation, processing/removal reads, processing-state changes, chunk replacement/cleanup, and document deletion. `lib/textbook-storage` owns only private PDF `put`, `get`, and `delete`. There is no generic database CRUD, public URL, signed URL, arbitrary bucket, or browser-selected path/backend.

The historical server actions authenticate with Supabase Auth and require the existing admin-first admin role before either boundary is reached. The database operations historically used the service/admin client after that check. Supabase preserves that execution; PostgreSQL uses the existing fixed trusted transaction with static parameterized SQL and minimized projections. No RLS policy, grant, role, Auth identity, or schema changes are introduced. `uploaded_by` remains the server-derived Supabase Auth user ID.

`TEXTBOOK_STORAGE_BACKEND` is environment-only and defaults to `supabase`; `supabase` retains the private `textbooks` bucket, while `filesystem` requires an absolute non-root `TEXTBOOK_STORAGE_ROOT`. Database `storage_path` remains a provider-neutral relative key in the established `textbooks/<textbook UUID>/<document UUID>/<safe PDF filename>.pdf` format. The filesystem provider validates the full UUID/path grammar, rejects traversal and backslashes, enforces the 12 MiB limit and PDF content type, creates private directories/files (`0700`/`0600`), writes through a same-filesystem temporary file plus atomic no-overwrite link, reads only bounded regular files, and performs idempotent deletion. Files are never served publicly.

Upload ordering remains validation and authorization, private file write, document-row insert, then UI revalidation. A document-row failure still triggers best-effort file compensation. Processing remains document metadata read, processing-state update, private file read, PDF extraction, chunking, batched 2048-dimensional embedding generation, chunk replacement, ready metadata, and revalidation. PostgreSQL atomically replaces chunks and publishes `ready`, and atomically clears chunks while recording `failed`; the Supabase fallback retains its existing sequential Data API operations. Ready metadata retains page/character/chunk counts, embedding model/dimension, and `processed_at`, so newest-ready selection and exact regeneration provenance are unchanged.

Removal retains the conservative historical ordering: validate that the document is neither ready nor processing, delete the private file, then delete the database row (whose existing cascade removes chunks). Unlike the prior ignored Storage response, a filesystem/provider delete failure now blocks the database delete; this is required to prevent an unreachable orphan file when the local disk operation fails. A later database failure can still leave a row whose file was removed. Cross-resource atomicity is impossible without an outbox/repair process, so upload-compensation failure and delete-after-file database failure remain documented technical debt rather than being redesigned in this slice. Processing-state update failures and abandoned `processing` rows likewise remain operational-recovery debt; no queue, retry scheduler, or state-machine redesign is added.

RAG remains private and scoped through the existing ready-document and `match_textbook_chunks` contracts. Chunk rows retain `document_id`, `textbook_id`, page range, stable chunk index, metadata, text, and vector(2048). No retrieval RPC, bounded top-K behavior, selected-textbook authorization, ready-document ordering (`processed_at DESC LIMIT 1`), or persisted regeneration document provenance changes.

Contract tests cover the Supabase workflow and Storage shapes, backend defaults, key containment, private permissions, atomic no-overwrite writes, bounded reads, idempotent deletion, and absence of direct table/Storage access in actions. Disposable PostgreSQL integration covers metadata, processing transitions, vector(2048) chunk provenance, atomic ready/failure handling, and deletion. Rollback is configuration-first: leave `DATABASE_BACKEND` and `TEXTBOOK_STORAGE_BACKEND` unset (or set both to `supabase`). Production data and files are not migrated by this code-only phase.

Direct runtime database reads fall from two to zero and direct runtime writes fall from nine to zero. Supabase Storage calls no longer occur directly in actions; the fallback adapter contains the three primitive SDK calls that serve the four historical operational paths (upload, compensating delete, processing download, removal delete).

## Write Phase 5: direct payment state writes

Write Phase 5 moves only the two remaining direct `payments` mutations in `SupabasePaymentRepository` behind the narrow server-only `lib/payment-state-write` repository. `saveInitiation` records the result of provider initiation, and `recordTerminal` records a failed, cancelled, or expired attempt. Payment reporting, entitlement, attempt reads, begin-attempt/finalization RPCs, callbacks, reconciliation decisions, textbook Storage, Auth, and every other write remain unchanged.

Both historical mutations used `createAdminClient()` inside the trusted payment state-machine boundary. The dual-backend adapters preserve that execution model: Supabase continues to use the admin client, while PostgreSQL uses the existing trusted transaction helper. Neither repository operation is browser-facing or accepts a role, backend, table, SQL fragment, teacher identity, amount, currency, or provider choice. SQL is static and parameterized, predicates by payment ID and the exact eligible prior status, and returns only the bounded normalized attempt fields required by the existing caller.

For an accepted initiation, the existing transition remains `initiated` to `pending`, with `verification_status = 'pending'`, the generic `external_request_id` and `provider_request_id`, the provider-safe description truncated to 500 characters, `query_next_at` set 30 seconds ahead, and `updated_at`. For a rejected initiation, the transition remains `initiated` to `failed`, with `verification_status = 'rejected'`, the same description/default behavior, and `updated_at`. A missing/ineligible row or database failure retains the existing sanitized `VERIFICATION_FAILED` application error. Although the historical mutation selected the full row, recursive caller review shows the state machine consumes only the normalized `PaymentAttempt` fields, so the new adapters use an explicit minimized projection.

`recordTerminal` remains best-effort. It updates only attempts currently in `initiated` or `pending`, sets the supplied canonical terminal status plus `verification_status = 'rejected'`, truncates result code/description to their historical limits, and updates the timestamp. Undefined optional values remain omitted/preserved exactly as in the Supabase client serialization. Errors remain intentionally ignored. This method neither creates paid state nor changes amount, currency, ownership, provider correlation, receipts, lease acquisition, retry counts, idempotency, uniqueness, cooldowns, limits, or entitlement.

The abstraction is provider-neutral: it uses canonical status and generic external/provider request identifiers and contains no M-Pesa, CheckoutRequestID, MerchantRequestID, or receipt contract. Daraja continues to map its identifiers in the unchanged provider adapter and payment core. Future providers can use the same state-write contract without being modeled as M-Pesa, but no card provider or payment-state redesign is included.

Supabase contract tests cover exact payloads, predicates, projections, terminal best-effort behavior, default backend selection, minimized contracts, and separation from reporting, entitlement, and attempt reads. Disposable PostgreSQL integration covers accepted/rejected transitions, ineligible-state protection, terminal behavior, generic future-provider fixtures, provider-correlation uniqueness, and preservation of amount/currency/ownership. Existing payment-core and Daraja suites remain the regression authority for initiation, callbacks, STK Query, trusted finalization, leases/backoff, and canonical paid state.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Direct runtime writes fall from 11 to 9, all remaining in the parked textbook/document/chunk Storage and ingestion domain. The two direct Storage-coupled textbook-document reads and all four Storage calls remain unchanged. No schema, policy, Auth, provider, production-data, or deployment change is included.

## Write Phase 4: app-settings price upsert

Write Phase 4 moves only `updateExamPackagePrice`'s direct `app_settings` upsert into the fixed-purpose server-only `lib/app-settings-write` repository. Historically the action resolved the current Supabase Auth user and admin-first role, required `admin`, validated the submitted amount with `validateExamPackagePrice`, and used the ordinary authenticated Supabase client plus existing `public.is_admin()` RLS. It upserted the fixed key `exam_package_price`, exact JSON value `{ amount, currency: "KES" }`, and an action-generated ISO `updated_at`, with `onConflict: "key"`. The same error/success messages and `/admin/settings` revalidation remain unchanged.

Validation remains the existing whole-KES safe-integer contract: digit-only strings or integers from 1 through 100,000 are accepted; zero, negative, fractional, malformed, whitespace-padded, or out-of-range values receive the existing `Price must be a whole KES amount between 1 and 100000.` message. No fallback price, unit conversion, pricing rule, payment initiation behavior, or currency semantics changed.

The repository factory repeats server-side Supabase Auth/admin authorization and accepts no caller-selected key, value shape, currency, backend, identity, role, table, or execution mode. PostgreSQL uses `withAuthenticatedTransaction(user.id)` and the existing authenticated app-settings RLS; it does not use trusted/service execution, superuser access, new policies, or new grants. Its parameterized `INSERT ... ON CONFLICT (key) DO UPDATE` writes only the fixed key, canonical JSON, and timestamp, and fetches no row.

Supabase contract tests cover the exact upsert payload/options, default backend, validation bounds/message, sanitized failures, authorization architecture, and UI revalidation. Disposable PostgreSQL integration covers insert/update conflict behavior, exact JSON/timestamp storage, dual-role admin authorization, teacher/unknown/raw-runtime denial, and restoration of the prior synthetic setting. Existing app-settings reads and payment-core tests remain authoritative for unchanged server-side price consumption.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Direct runtime writes fall from 12 to 11: payments 2 and textbook/document/chunk writes 9. Auth, payment writes/RPCs, textbooks, Storage, and production data remain unchanged.

## Write Phase 3: teacher profile update

Write Phase 3 moves only `updateTeacherProfile`'s direct `teachers` update into the narrow server-only `lib/teacher-profile-write` repository. The historical action trimmed `name`, `school`, and `phone`; required a name of 2-100 characters; limited school to 160 and phone to 30; called Supabase Auth `getUser()`; required the admin-first effective role to equal `teacher`; and updated `{ name, school: school || null, phone: phone || null }` where `user_id` equaled the validated Auth user ID. Its exact session, role, database-failure, and success messages remain unchanged, and it historically performed no cache revalidation.

The factory obtains identity only through the existing central Supabase Auth context and resolves the existing admin-first application role before backend selection. A dual-role admin, teacherless authenticated user, or unauthenticated request cannot obtain the repository through the application boundary. The Supabase adapter retains the ordinary authenticated client and explicit `user_id` predicate. PostgreSQL uses transaction-local authenticated identity, the same explicit predicate, and existing self-update RLS. The existing column grant continues to limit authenticated updates to `name`, `school`, and `phone`; no trusted/service role, superuser, policy, grant, Auth, or identity-schema change is introduced.

The repository fetches no row and preserves historical no-match success semantics. It cannot change `id`, `user_id`, or `created_at`. Contract tests cover the exact Supabase payload/predicate, null normalization, sanitized failures, environment-only backend, central Auth/role architecture, validation, messages, and absence of revalidation. Disposable PostgreSQL integration covers self-only updates, nullable school/phone, Teacher A/B isolation, unknown-user no-op behavior, raw runtime denial, restoration of fixtures, and read-after-write parity through the identity-read abstraction.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Direct runtime writes fall from 13 to 12: app settings 1, payments 2, and textbook/document/chunk writes 9. The two direct Storage-coupled textbook-document reads and all four Storage calls remain untouched.

## Write Phase 2: curriculum hierarchy admin writes

Write Phase 2 moves only the twelve direct Supabase source occurrences for ordinary `strands`, `sub_strands`, and `learning_outcomes` mutations in `app/actions/admin.ts` into the narrow server-only `lib/curriculum-write` repository. The effective domain API has nine methods—create, update, and delete for each table—while the other three historical occurrences are the update actions' `PGRST204` legacy-schema fallbacks. Curriculum import RPCs, `strand_objectives`, source exceptions, profile/settings/payment/textbook writes, Auth, Storage, and exam/RPC writes remain unchanged.

All operations historically used the ordinary cookie-authenticated Supabase server client after form validation and the existing admin-first Supabase Auth role check. Existing authenticated RLS write policies call `public.is_admin()`. Both the factory and action retain server-side admin authorization; PostgreSQL uses `withAuthenticatedTransaction(user.id)` for every mutation and never uses trusted/service execution, BYPASSRLS, a superuser, arbitrary roles, new policies, or caller-selected backend/identity inputs.

The stored CBC and Form structures are unchanged. A strand remains the CBC strand or Form topic, and a sub-strand remains the CBC sub-strand or Form sub-topic. Learning outcomes remain ordinary children where explicitly created; the write adapter neither fabricates outcomes for Form nor moves Form's topic-level `strand_objectives` into `learning_outcomes`. Parent IDs are immutable through updates. Inserts write only the historical parent/name or description fields and rely on existing FK/default behavior. Updates change only name/description plus the historical modern-schema provenance reset: `source_code` where applicable, `verification_status`, `outcome_status` where applicable, `source_ref`, and `source_metadata`. They preserve `sort_order`, `is_active`, parent IDs, and import IDs. Supabase alone retains the exact legacy `PGRST204` fallback to name/description-only updates.

Application validation is unchanged: UUID validation, trimmed required strand/sub-strand names up to 180 characters, and trimmed required multiline outcome text up to 1000 characters. Existing read repositories scope duplicate checks to the current parent and compare case-insensitively while excluding the edited row. Existing partial/full case-insensitive unique indexes and FKs remain the final database protection. Create actions do not add new parent pre-reads; invalid parents continue to fail at the FK boundary. No ordering value is accepted or renumbered.

Delete protections remain in the action before repository access. A strand with sub-strands is blocked. A sub-strand with learning outcomes is blocked, and the existing admin-reporting JSON reference check separately blocks any saved exam whose canonical sub-strand UUID appears in exam content. Deletes predicate only by validated ID and return only `id`, preserving missing-row behavior. The dependency reads and delete remain separate transactions, so the historical race window remains: the schema's `ON DELETE CASCADE` relationships from strands to sub-strands/strand objectives and from sub-strands to learning outcomes still apply if a child appears after the precheck. No FK or cascade was changed. Exam JSON has no FK, so the deliberate application reference check remains essential and unchanged.

The Supabase adapter reproduces exact tables, payloads, predicates, legacy fallbacks, and delete `.select("id")` behavior. The PostgreSQL adapter uses explicit static SQL, parameterized UUID/text values, no dynamic tables, no `RETURNING *`, and authenticated transaction-local RLS. Inserts and updates fetch no rows; deletes return only `id`. Action boundaries retain existing validation, dependency, not-found, operation-specific error, success, and `revalidatePath("/admin/curriculum")` behavior without exposing SQL or constraint details.

Contract tests cover the twelve Supabase call shapes, legacy fallbacks, delete existence, backend selection, server-only admin/RLS architecture, validation, and dependency boundaries. Disposable PostgreSQL integration covers hierarchy create/update/delete, parent FKs, case-insensitive duplicates, preservation of sort order, provenance resets, CBC/Form isolation, Form-without-outcomes behavior, RLS denial, missing deletes, and read-after-write visibility through `lib/curriculum-read`. Existing curriculum import/validation and exam-reference tests remain authoritative for frozen import and dependency behavior.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Before checkpoint, remove only Write Phase 2 worktree changes; after checkpoint, revert only its reviewed commit. No schema, policy, production data, Auth, Storage, payment, or import rollback is required.

Using the reconciled source-occurrence method, twelve Supabase fallback-adapter writes replace twelve direct curriculum writes. Direct runtime writes fall from 25 to 13: teacher profile 1, app settings 1, payments 2, and textbook/document/chunk 9. The only two direct runtime reads remain the deliberately deferred Storage/write-coupled `textbook_documents` reads, and all four Storage calls remain unchanged.

The recommended next write slice is the isolated teacher-profile update, followed separately by the app-settings upsert. Both are substantially narrower than payment or textbook ingestion writes and can preserve Supabase Auth identity/RLS without crossing the parked Storage boundary. This recommendation is not implemented in Write Phase 2.

## Write Phase 1: subject and grade admin CRUD

Write Phase 1 moves only the six ordinary catalog mutations in `app/actions/admin.ts` into the narrow server-only `lib/catalog-write` repository: create, update, and delete for `subjects`, and the equivalent three operations for `grades`. Curriculum, profile, settings, payment, textbook/document/chunk, RPC, Auth, and Storage mutations remain unchanged.

Historically all six actions used the ordinary cookie-authenticated Supabase server client. Each action first validated its form input, then required a validated Supabase Auth user whose existing admin-first role resolver returned admin. The table policies authorize writes with `public.is_admin()`. The PostgreSQL adapter preserves this execution model with the existing authenticated transaction-local identity; it does not use `service_role`, trusted execution, superuser access, arbitrary roles, or new RLS policies. The repository factory repeats the server-side user and admin-role check before backend selection, and accepts no browser identity, role, backend, table, or execution-mode input.

Validation remains application-identical. Subject names are trimmed, required, and limited to 120 characters. Grade/class names and education levels are separately trimmed, required, and limited to 80 characters. IDs use the existing UUID validator. Duplicate prevalidation remains case-insensitive over the complete migrated catalog reads, excluding the current row on update. Database enforcement remains the existing case-insensitive unique indexes on `lower(subjects.name)` and `lower(grades.name)`; no new constraint or coercion was introduced. Subject inserts write only `name`; grade inserts write only `name` and `level`; updates change those same historical fields. PostgreSQL-generated UUIDs and timestamps retain their schema defaults.

Delete protections are unchanged. After admin authorization, `getSubjectDependencies` or `getGradeDependencies` counts curriculum strands, textbooks, and exams. Any nonzero category produces the existing deliberate dependency message. Clean deletes then predicate by validated ID and return only `id` so missing rows retain the existing not-found response. The dependency check and delete remain separate transactions, preserving the historical race window without adding cascade behavior or weakening constraints. Existing restrictive references such as exams remain database-authoritative; existing curriculum/textbook foreign keys include cascades, so the application precheck remains the deliberate protection against those cascades and a dependency inserted in the historical check/delete race window could still be cascaded. This is documented rather than redesigned in the transport migration.

The Supabase adapter reproduces the exact insert/update/delete builders and uses `.select("id")` only for deletes. Inserts and updates do not fetch rows. The PostgreSQL adapter likewise uses no `RETURNING` clause for inserts or updates and returns only `id` for deletes to preserve existence semantics. Adapter failures are caught at the action boundary and retain the existing operation-specific messages without exposing SQL, constraint, or connection details. Existing success messages and `revalidatePath("/admin/subjects")` / `revalidatePath("/admin/grades")` behavior are unchanged.

Contract tests cover the Supabase mutation shapes, delete existence behavior, environment-only backend selection, server-only authorization architecture, validation, dependency categories, and absence of direct subject/grade writes in actions. Disposable PostgreSQL integration covers real create/update/delete operations, case-insensitive uniqueness, missing deletes, RLS denial for teacher/unknown identities, final database state, and read-after-write visibility through the existing catalog read abstraction.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Before checkpoint, remove only Write Phase 1 worktree changes; after checkpoint, revert only its reviewed commit. No schema, policy, Auth, Storage, payment, or production rollback is required.

Using the reconciled source-occurrence method, six new Supabase fallback-adapter writes replace the six direct subject/grade writes. Direct runtime writes fall from 31 to 25. The remaining direct writes are curriculum 12, profile 1, app settings 1, payment 2, and textbook/document/chunk 9. The two direct `textbook_documents` reads and all four Storage calls remain deliberately deferred with the later Storage/ingestion migration.

The recommended next write slice is curriculum hierarchy CRUD (`strands`, `sub_strands`, and `learning_outcomes`), but only after Write Phase 1 is reviewed and checkpointed. That slice should preserve its legacy compatibility updates, parent validation, exam-reference/dependency checks, and curriculum-import RPC boundary; it must not include textbook Storage or payment writes.

## CRUD Phase 10C: payment attempt and reconciliation reads

Phase 10C moves the final three direct payment-table reads from `SupabasePaymentRepository` into the server-only `lib/payment-attempt-read` repository: `getAttempt(paymentId)`, provider-scoped `getAttemptByExternalRequest(provider, externalRequestId)`, and `getLatestAttemptForExam(teacherId, examId)`. Reporting, entitlement, generic CRUD, payment writes, and provider implementations remain separate.

Historically all three reads used `createAdminClient()` and therefore intentionally executed through the existing trusted service boundary. `getAttempt` selected the full row by primary-key `id` with `maybeSingle`. `getAttemptByExternalRequest` selected the full row with `provider = 'daraja'`, `external_request_id`, and `maybeSingle`. `getLatestAttemptForExam` first performed the existing trusted exam-ownership assertion, then filtered by `exam_id`, server-derived `teacher_id`, and statuses `initiated`, `pending`, or `paid`, ordered only by `created_at DESC`, and applied `LIMIT 1` plus `maybeSingle`. The PostgreSQL adapter preserves trusted execution and these exact predicates; no RLS, policy, role, or privilege changes are introduced.

The repository replaces historical `select('*')` transport with the exact effective `PaymentAttempt` projection: `id`, exam and teacher IDs, whole-KES amount, currency, phone, provider, canonical status, generic external/provider request IDs, generic provider reference, creation time, and completion time. Normalization retains the existing safe-integer amount check, exact `KES` check, and canonical statuses `initiated`, `pending`, `paid`, `failed`, `cancelled`, and `expired`. `verification_status`, result text, idempotency data, `mpesa_ref`, update/initiation timestamps, and query lease/backoff columns were never part of the normalized application attempt and remain excluded. Lease acquisition, attempt count, backoff, and release continue exclusively through the existing trusted RPC/write path, so lease tokens never leave server-side database operations.

Provider concepts remain generic at the repository boundary. For current Daraja operation, `external_request_id` stores `CheckoutRequestID`, `provider_request_id` stores `MerchantRequestID`, and `provider_reference` is the generic finalization/correlation reference (currently the safe `daraja-checkout-{CheckoutRequestID}` fallback when the provider check supplies no reference). `mpesa_ref` remains the distinct `MpesaReceiptNumber` receipt and is not part of attempt reads. The existing Daraja callback wrapper explicitly calls the provider-scoped repository operation with `daraja`; another provider can use its own provider key and generic identifiers without M-Pesa-only fields.

The uniqueness assumptions are unchanged: payment `id` is the primary key, while `(provider, external_request_id)`, `(provider, provider_request_id)`, `(provider, provider_reference)`, and `(provider, mpesa_ref)` have their existing partial unique indexes when non-null. `maybeSingle` error/missing behavior remains null; the PostgreSQL adapter also returns null for query errors, malformed UUIDs, zero rows, or an unexpected non-single correlation result, while stored-row normalization errors still fail closed.

Attempt reuse behavior is unchanged. The latest read considers only `initiated`, `pending`, and `paid`, ignores later failed/cancelled/expired attempts, and has no provider filter. It orders only by `created_at DESC`; no ID tie-breaker was added, so equal-timestamp winners remain historically unspecified. Teacher and exam predicates prevent cross-teacher and cross-exam reuse, and the existing ownership assertion occurs before the trusted latest-attempt query.

The trusted boundary remains narrow. Payment IDs reach `getAttempt` only from trusted state-machine results: an attempt returned by initiation/latest/callback correlation or a second read after lease contention. Public payment status actions supply an exam ID and derive the teacher actor server-side. The public Daraja callback supplies bounded provider identifiers, which are correlated by both provider and external request before any payment ID is used. No request can select a teacher ID, trusted mode, database backend, or database role.

Supabase contract tests preserve all three query chains, projections, status filters, ordering, missing behavior, normalization, and environment-only backend selection. Disposable PostgreSQL fixtures cover multiple teachers/exams/attempts, all relevant statuses, provider-scoped Daraja and future-provider correlation, malformed/missing IDs, partial-unique enforcement, lease/backoff-shaped rows, equal timestamps, and data minimization. Existing payment-core, Daraja, Security B1, lease/backoff, reporting, entitlement, and document regressions remain authoritative for unchanged state-machine behavior.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Before checkpoint, remove only Phase 10C worktree changes; after checkpoint, revert only its reviewed commit. No schema, payment-state, provider, Auth, Storage, or production rollback is required.

Using the reconciled source-occurrence method, three new Supabase fallback calls replace the final three direct payment reads. Fallback adapter calls become 55, direct runtime reads become two, writes remain 31, and the literal `.from()` total remains 88. Auth calls remain 19, Storage calls remain four, and dynamic maintenance reads remain four. The only remaining direct runtime reads are the two deliberately deferred Storage/write-coupled `textbook_documents` reads.

After payment reads, the safest next work is not payment writes. Audit the two deferred textbook-document reads together with their Storage upload/removal and ingestion state transitions, but do not migrate them until a separately authorized slice can preserve `storage_path`, file mutation ordering, and failure recovery. Better Auth, Storage replacement, payment writes, provider expansion, and VPS cutover remain later independent decisions.

## CRUD Phase 10B: payment entitlement read

Phase 10B moves only the payment-table existence check used by `getExamDownloadEntitlement` into the separate server-only `lib/payment-entitlement` repository. Its sole operation is `hasSuccessfulPaymentForExam(examId)`. It is intentionally not part of payment reporting, generic payment CRUD, or the Phase 10C attempt/reconciliation repository.

The historical Supabase query selected only `id`, filtered by the already-authorized `exam_id`, the teacher ID derived from Supabase Auth, and `status = 'paid'`, then applied `LIMIT 1`. It had no ordering, `single`/`maybeSingle`, provider, `verification_status`, amount, currency, receipt, or correlation filter. Zero rows or a query failure meant no payment entitlement; one or multiple paid rows meant entitlement by existence. Both adapters preserve that effective contract.

Canonical entitlement therefore remains the generic payment state `status = 'paid'`. `verification_status` does not independently participate in this read. The existing trusted finalization function is responsible for verifying exam/teacher/provider/amount/currency/reference correlation before atomically writing both payment `status = 'paid'`, `verification_status = 'verified'`, completion evidence, and the exam entitlement status. Authenticated users retain read-only payment privileges and cannot create this state. STK acceptance, callback receipt, external/provider request IDs, `provider_reference`, or `mpesa_ref` without canonical paid status do not unlock anything.

Ownership remains server-derived: Supabase Auth, admin-first role resolution, exact teacher profile, ownership-scoped exam metadata, then the ownership-scoped payment existence check. PostgreSQL uses the existing authenticated transaction identity and explicit `exam_id` plus `teacher_id` predicates; it does not enter trusted/service execution and additionally rejects `public.is_admin()` as defense in depth. The Supabase adapter retains the ordinary authenticated client and existing payment RLS. No browser argument supplies teacher identity, backend, database role, or execution mode.

Admin behavior is unchanged and remains separate from payment rows. The existing admin document/PDF branch returns before teacher identity or payment lookup; it does not create or infer a payment and does not broaden admin marking-scheme RLS. Dual-role users resolve admin-first and cannot enter the teacher entitlement repository.

Legacy exam status remains unchanged. After the owned exam metadata lookup, entitlement is the existing OR expression: a canonical paid payment row, `exam.status = 'paid'`, or `exam.status = 'downloaded'`. Phase 10B neither removes nor expands that migration-era fallback. Paid PDF loading order remains authentication, role/ownership metadata, entitlement, private exam/marking content, canonical validation, and rendering. Unpaid teacher previews remain unchanged.

The query is provider-neutral. It does not name Daraja, M-Pesa, a receipt, or a provider. Synthetic PostgreSQL coverage proves a hypothetical card-provider row in the same canonical paid state grants entitlement, while pending/failed Daraja rows carrying external request IDs, provider request IDs, provider references, and even receipt-shaped fixture data do not. Future card ingestion/finalization must still satisfy the existing trusted canonical state transition; no card implementation or provider-state redesign is included here.

Amount and currency are not revalidated by the entitlement read because that was not the historical contract. Existing database constraints enforce positive bounded whole-KES rows, while trusted finalization compares the verified provider amount/currency with the stored attempt before writing paid state. Existing payment-core/Daraja tests remain the authority that underpayment or wrong currency cannot finalize.

The three Phase 10C reads remain unchanged in `SupabasePaymentRepository`: `getAttempt(paymentId)`, `getAttemptByExternalRequest(externalRequestId)`, and `getLatestAttemptForExam(actor, examId)`. Their service-client execution, full attempt normalization, Daraja correlation, reuse ordering, and reconciliation semantics are untouched. Every payment write/RPC, callback, query, lease, finalization, entitlement mutation, Auth call, Storage operation, and textbook-document path also remains unchanged.

Contract tests cover the exact Supabase projection/filter/limit, missing/error behavior, environment-only backend, server-derived identity, provider/receipt independence, legacy status fallback, Phase 10C separation, and private-content loading order. Disposable PostgreSQL fixtures cover Teacher A/B, unknown and raw unauthenticated identities, dual-role denial, paid/pending/failed rows, multiple paid rows, other-exam/other-teacher rows, request/reference/receipt-only evidence, malformed IDs, and a canonical synthetic future provider.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Before checkpoint, remove only the Phase 10B worktree changes; after checkpoint, revert only its reviewed commit. No schema, provider, payment-state, or production rollback is required.

Using the reconciled source-occurrence method, one new Supabase fallback call replaces the direct entitlement read. Fallback adapter calls become 52, direct runtime reads become five, writes remain 31, and the literal `.from()` total remains 88. Auth calls remain 19, Storage calls remain four, and dynamic maintenance reads remain four. Remaining direct reads are the three Phase 10C `payments` reads and two deferred Storage/write-coupled `textbook_documents` reads.

The recommended Phase 10C audit should treat the three service-backed attempt/reconciliation reads as one security-critical state-machine slice. It must preserve full-row normalization, provider correlation, exact latest-attempt status/order semantics, trusted execution, leases/backoff, and every mutation/RPC boundary without combining the work with provider implementation or writes.

## CRUD Phase 10A: payment reporting reads

Phase 10A audits all six remaining ordinary runtime `payments` reads and migrates only the two reporting operations. `listTeacherPaymentHistory()` replaces the transaction-page read in `app/teacher/transactions/page.tsx`; `getAdminPaidRevenue()` replaces the dashboard aggregation in `app/admin/page.tsx`. The repository is deliberately reporting-only and is not imported by payment initiation, entitlement, callback, query, reconciliation, or finalization code.

Teacher history preserves the existing server sequence: validated Supabase Auth identity, admin-first role resolution requiring the effective `teacher` role, server-derived `teachers.id`, then an explicit `payments.teacher_id` predicate. It returns the same maximum 100 rows ordered by `created_at DESC`, with only payment ID, whole-KES amount, currency, status, nullable receipt reference, created/completed timestamps, and the related exam-type label. It returns every historical status rather than treating reporting status as entitlement. Phone, provider request/correlation fields, callback data, retry counters, leases, exam JSON, and other private domains are excluded.

The committed teacher-history query used `createAdminClient()` after server-side teacher resolution. That trusted projection was intentional because authenticated table privileges do not grant `mpesa_ref`, which the existing UI displays in masked form. `mpesa_ref` was originally the M-Pesa reference, but the provider-independent correlation migration separated `provider_reference` from the independently verified receipt stored in this legacy-named column. The repository therefore normalizes it to the provider-neutral `receiptReference`; it does not rename the database column or conflate it with `provider_reference`. The current UI still labels and masks it as the M-Pesa receipt. The PostgreSQL implementation reauthorizes the exact teacher mapping under the authenticated transaction identity, explicitly rejects an effective admin (including a dual-role admin), and only then performs the same narrow trusted query with the server-derived teacher ID. No caller supplies teacher identity, backend, role, or execution mode.

Admin revenue preserves the exact historical definition: the sum of `amount` for every row whose `status = 'paid'`. It does not add a provider, verification-status, date, teacher, exam, or currency filter. The database constrains payment amounts to positive whole-KES integers and currency to `KES`. PostgreSQL uses `SUM(amount)` and transports its bigint result as text; both adapters accumulate with exact integer arithmetic and reject totals outside JavaScript's safe display range before returning the existing numeric UI contract. No rows yields zero.

The committed admin query used the ordinary authenticated Supabase server client under the existing `payments_admin_select` RLS policy. The PostgreSQL adapter preserves that execution mode with the validated Auth user transaction context and `public.is_admin()`. Teacher-only, unknown authenticated, and unauthenticated identities cannot obtain admin revenue; the existing dual-role identity resolves admin-first and may use the admin report but cannot enter teacher history.

The other four reads remain direct and intentionally deferred: `getExamDownloadEntitlement` checks for an owned paid row; `getAttempt(paymentId)` supports reconciliation; `getAttemptByExternalRequest(externalRequestId)` supports provider callback/query correlation; and `getLatestAttemptForExam(actor, examId)` supports payment-attempt reuse and status polling. The last three use the existing service-backed payment repository, and the entitlement lookup remains the existing authenticated/RLS path. None imports or derives authorization from reporting data.

Payment writes and security semantics are unchanged: configured price, KES, ownership, phone normalization, begin-attempt RPC, Daraja OAuth/STK Push, callback handling, STK Query, trusted finalization, amount/currency verification, provider/receipt correlation and uniqueness, idempotency, cooldowns, limits, leases/backoff, entitlement, and both PDF gates remain on their existing code paths. Reporting does not filter by provider: a future provider using the existing canonical statuses, amount/currency fields, and receipt convention will appear in history and contribute to paid revenue without a reporting rewrite. Provider ingestion and provider-specific UI remain later work; no card implementation is included. No schema, RLS policy, grant, Auth, Storage, textbook-document, or production change is included.

Contract tests cover the exact Supabase projection/filter/order/limit, all-status history, null receipt/timestamp behavior, paid-only revenue, zero rows, exact whole-KES arithmetic, environment-only backend selection, minimized contracts, and separation from payment authorization. Disposable PostgreSQL fixtures cover Teacher A/B isolation, all six schema-supported payment statuses, admin/teacher/unknown denial, dual-role behavior, paid-only global revenue, metadata minimization, and denial to the raw runtime connection.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Before checkpoint, remove only the Phase 10A worktree changes; after checkpoint, revert only its reviewed commit. No database, payment, provider, or production rollback is required.

Using the reconciled source-occurrence method, two new Supabase fallback calls replace two direct runtime reporting reads. Fallback adapter calls become 51, direct runtime reads become six, writes remain 31, and the literal `.from()` total remains 88. Auth calls remain 19, Storage calls remain four, and dynamic maintenance reads remain four. Remaining direct reads are `payments` 4 and the two deferred Storage/write-coupled `textbook_documents` reads.

The recommended Phase 10B audit should isolate the single authenticated entitlement lookup from the three service-backed reconciliation/attempt lookups. Entitlement should be reviewed as its own ownership-and-PDF gate slice; reconciliation lookups should remain a later, separate security-critical slice with the payment mutation/RPC state machine unchanged.

## CRUD Phase 9: remaining exam reads

Phase 9 moves the final two ordinary runtime `exams` reads into the existing server-only `lib/exam-read` abstraction. Both are payment-adjacent metadata reads, but neither reads or changes payment state. No new exam repository or generic CRUD layer is introduced.

The first original call site was `getExamDownloadEntitlement` in `lib/payments/server.ts`. It used the ordinary authenticated Supabase client to select only `id, status`, filtered by the browser-supplied lookup ID and the teacher ID derived server-side from Supabase Auth. It is now `getTeacherExamPaymentMetadata(id)` on the existing teacher repository. The PostgreSQL adapter uses the validated Auth user transaction context plus an explicit `id` and `teacher_id` predicate. Existing, foreign-owned, missing, query-error, and malformed-ID behavior remains metadata-or-null, so foreign and nonexistent exams remain indistinguishable. Admin entitlement still returns through its existing admin branch before this teacher operation.

The second original call site was `SupabasePaymentRepository.assertOwnedExam`. It intentionally used `createAdminClient()` to select only `id` with both `exam.id` and the server-derived payment actor's `teacher_id`, returning the existing forbidden error when no row was found. It is now the separate `TrustedExamReadRepository.teacherOwnsExam(id, teacherId)` operation. The Supabase adapter retains the service client; the PostgreSQL adapter retains the fixed trusted transaction. This trusted method is reachable only from the server-side payment repository after `currentPaymentActor` has authenticated the user, required the resolved `teacher` role, and derived the teacher profile. No request can select a teacher ID, backend, role, or execution mode.

Both SQL queries use explicit minimized projections and parameterized UUIDs. They return no exam JSON, marking content, payment row, phone, provider reference, receipt, AI data, or textbook data. The authenticated query has defense-in-depth ownership and RLS identity. The trusted query has the same explicit two-column predicate as the historical service-client check. No RLS policy, grant, role, or schema changes are included.

The surrounding payment behavior is unchanged. The entitlement function still performs its existing authenticated `payments` lookup after exam ownership metadata. Payment initiation still calls `assertOwnedExam` before the existing trusted begin-attempt RPC. Authoritative pricing, KES, phone normalization, limits, cooldowns, STK Push, callbacks, query reconciliation, finalization, correlation, receipt/reference uniqueness, idempotency, leases/backoff, and both PDF gates remain on their existing paths. All exam, marking-scheme, editor, regeneration, status/revision, payment, and entitlement writes are unchanged.

Supabase contract tests cover exact projections, ownership filters, false/null behavior, and the distinct authenticated/trusted boundaries. Disposable PostgreSQL fixtures cover Teacher A/B symmetry, own and foreign rows, missing and malformed IDs, relevant statuses, raw/unknown identity denial, metadata minimization, and trusted ownership parity. Existing payment, Daraja, document/PDF, exam, RPC, Security B1, and RAG suites remain regression gates.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Before checkpoint, remove only the Phase 9 worktree changes; after checkpoint, revert only its reviewed commit. No database, payment, or production rollback is required.

Using the reconciled source-occurrence method, two new Supabase fallback calls replace the final two direct runtime exam reads. Fallback adapter calls become 49, direct runtime reads become eight, writes remain 31, and the literal `.from()` total remains 88. Auth calls remain 19, Storage calls remain four, and dynamic maintenance reads remain four. Remaining direct runtime reads are the six `payments` reads and the two deliberately deferred Storage/write-coupled `textbook_documents` reads; direct `exams` reads become zero.

The recommended next database slice is a separately audited read-only payment-table phase. Because those six reads participate directly in entitlement, reconciliation, provider state, and transaction history, they must not be combined with payment writes, Daraja redesign, Auth, Storage, or ordinary write migration.

## CRUD Phase 8: app-settings read

Phase 8 moves the one ordinary runtime `app_settings` read behind the narrow server-only `lib/app-settings-read` repository. Its only operation is `getExamPackagePrice`; it exposes neither arbitrary setting keys nor generic settings CRUD. The migrated call site is `getExamPackagePrice` in `lib/payments/server.ts`, used to display the configured package price when an authorized teacher does not yet have download entitlement and by the already-protected admin settings page.

The exact setting remains `exam_package_price`. Its `value` is non-null JSONB seeded as `{ "amount": 100, "currency": "KES" }`; the read extracts only `amount`. The application accepts a safe whole-KES integer or a digit-only string and enforces the existing inclusive range of KES 1 through KES 100,000. It does not multiply or divide by 100 and performs no floating-point currency conversion. A missing row, query error, JSON null, array, or non-object remains `NOT_CONFIGURED`. A missing, malformed, fractional, zero, negative, or out-of-range amount remains `INVALID_PRICE`. There is no fallback price.

Historical execution used `createAdminClient()` with the fixed key after the relevant server boundary; it did not use the requesting user's table RLS. The Supabase adapter retains that exact service-backed query and `maybeSingle` behavior. The PostgreSQL adapter therefore uses the existing fixed trusted transaction, a parameterized key, an explicit `value` projection, and the database's unique `key` constraint. No request can provide the key, backend, role, price, SQL, or execution mode. No RLS policy or privilege changes are introduced.

Pricing remains server-authoritative. The browser payment action supplies an exam ID and phone, not an amount. The existing payment RPC independently reads the same setting, enforces the integer range and `KES`, and remains authoritative for attempt creation. STK acceptance and callbacks still do not create entitlement; trusted query/finalization, receipt/reference uniqueness, amount/currency checks, idempotency, cooldowns, limits, leases, and both existing PDF gates are unchanged.

The admin settings mutation in `app/actions/payment-settings.ts` remains the existing authenticated, admin-authorized Supabase `.upsert()` and is not part of this read migration. Payment rows, remaining exam reads, textbook processing/removal, Auth, Storage, Daraja, schema, and production data are unchanged.

Contract tests cover the fixed Supabase projection/key, default backend, whole-KES boundaries, missing/null/malformed behavior, and absence of a browser amount/backend/role input. The disposable PostgreSQL integration test changes only synthetic local setting data, restores the original fixture afterward, and proves both trusted access and denial to the raw runtime connection.

PostgreSQL integration files are stateful tests over one disposable parity database and are intentionally launched sequentially. They are not included in `npm test` or any parallel npm/CI test script. Run the parity bootstrap first, then invoke each `*.integration.test.ts` file as its own Node process; do not pass multiple integration files to one `node --test` invocation, because Node may execute them concurrently and their synthetic fixtures can overlap. The Phase 8 setting test restores the fixed `exam_package_price` fixture before its process exits.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Before checkpoint, remove only the Phase 8 worktree changes; after checkpoint, revert only its reviewed commit. No database or production rollback is required.

Using the reconciled source-occurrence method, one new Supabase fallback call replaces the one direct runtime read. Fallback adapter calls become 47, direct runtime reads become 10, writes remain 31, and the literal `.from()` total remains 88. Auth calls remain 19, Storage calls remain four, and dynamic maintenance reads remain four. Remaining direct runtime reads are `exams` 2, `payments` 6, and the two deferred Storage/write-coupled `textbook_documents` reads.

The recommended next slice is a separately audited read-only migration of the two remaining non-payment `exams` reads, provided they can be isolated without altering ownership, payment, PDF, or mutation semantics. Payment-table reads should remain a separate security-critical phase.

## CRUD Phase 7: textbook and textbook-document reads

Phase 7 adds the narrow server-only `lib/textbook-read` repository. The migrated operations are `listTextbooksForDuplicateCheck`, `textbookExists`, `listAdminTextbookDocuments`, `getTextbookForGrounding`, and `getReadyDocumentId`. They replace the four remaining ordinary `textbooks` reads and three safely separable `textbook_documents` reads in the textbook admin actions/page, initial exam grounding, and regeneration grounding.

The privacy model is unchanged: an authorized administrator creates a textbook record, privately uploads an authorized PDF, and processes/indexes it before an authenticated teacher can use it for grounded generation. Catalog and duplicate validation expose only textbook IDs/names. Admin document metadata is limited to the existing management projection: filename, byte size, processing status/error, page/chunk counts, source type, and creation time. The repository never returns `storage_path`, `uploaded_by`, authorization notes, hashes, extracted text, chunks, embeddings, or file URLs.

Readiness retains the existing state machine. Only a `textbook_documents.processing_status = 'ready'` row is usable for grounding. Initial generation preserves the historical `ORDER BY processed_at DESC LIMIT 1` expression exactly. No ID tie-breaker or explicit null ordering is added: equal newest timestamps have no historically defined winner, and a nullable ready `processed_at` retains PostgreSQL/PostgREST's default descending null behavior. The normal processing path sets `processed_at` when it writes `ready`, although the schema does not enforce that implication. Regeneration additionally requires the exact document ID recorded in immutable exam provenance and never substitutes a newer document. Uploaded, processing, failed, missing, cross-textbook, cross-subject, and cross-grade records remain unusable. Textbook mismatch and document-readiness errors remain distinct as before.

Both factories start from the central Supabase Auth-derived identity context and require the exact resolved application role. Admin operations require `admin`; grounding requires `teacher`, so a dual-role admin cannot enter the teacher grounding path. The committed pre-Phase-7 code used `createAdminClient()` for every migrated read: duplicate/existence checks after `adminContext`, admin document metadata under the admin route boundary, and both grounding readers after teacher authorization. PostgreSQL therefore repeats authorization under the authenticated transaction identity before entering the existing internal trusted boundary for only these same methods. The blanket removal of trusted execution would not be parity and would fail for the deliberately service-only private document tables. The boundary is fixed server-side and cannot be selected through request input. Queries use explicit projections and parameterized UUIDs.

The Supabase adapter retains the existing server-only admin-client boundary used by these private reads. The PostgreSQL adapter reproduces the same effective contracts without exposing the Pool or database credentials. Existing `match_textbook_chunks` RPC behavior remains unchanged: trusted execution, exact textbook/document scoping, a maximum of 12 rows at SQL level and the application `RETRIEVAL_TOP_K` bound, and 2048-dimensional vectors.

Two `textbook_documents` reads remain intentionally direct and Supabase-backed. The processing pre-read returns `storage_path` and immediately participates in Storage download plus ingestion/status/chunk writes. The removal pre-read returns `storage_path` and immediately participates in Storage deletion plus a document delete. Separating either would cross the explicitly deferred Storage/write boundary. All four Storage calls, every textbook/document/chunk mutation, PDF extraction, embedding, indexing, and processing-status transition are unchanged.

Contract tests cover Supabase projections, filters, empty results, the exact duplicate-name rule, historical ordering construction, readiness, and environment-only backend selection. Disposable PostgreSQL fixtures cover two grades/subjects, same-name books across scopes and publishers, matching and mismatched textbooks, older/newer/null/equal-timestamp ready documents, newer processing/failed documents, missing documents, exact provenance-document validation, minimized admin metadata, teacher/admin/unknown denial, dual-role behavior, and raw unauthenticated denial. No production data or copyrighted fixture content is used.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Before checkpoint, remove only Phase 7 worktree changes; after checkpoint, revert only its reviewed commit. Storage objects, ingestion data, schema, Auth, and production systems require no rollback.

Using the reconciled source-occurrence method, five new Supabase fallback calls replace seven direct runtime reads because the two grounding callers share the same adapter operations. Fallback calls rise from 41 to 46, direct runtime reads fall from 18 to 11, writes remain 31, and the literal `.from()` total falls from 90 to 88. Auth calls remain 19, Storage calls remain four, and dynamic maintenance reads remain four. Remaining direct runtime reads are `app_settings` 1, `exams` 2, `payments` 6, and the two deferred `textbook_documents` reads.

The recommended next slice is the isolated `app_settings` read, which is non-payment runtime configuration but should remain separate from the payment price setting and all writes. Payment reads remain deferred to their own security-critical phase.

## CRUD Phase 6: profile and role-resolution reads

Phase 6 adds the narrow, server-only `lib/identity-read` repository for ordinary `teachers` and `admins` reads. Supabase Auth remains authoritative: `getCurrentIdentityContext()` first calls the existing server `supabase.auth.getUser()`, and only its validated `user.id` constructs either adapter. No browser argument can supply an auth user ID, teacher/admin ID, role, backend, or execution mode.

The identity model is unchanged. `auth.users.id` maps through `teachers.user_id` and `admins.user_id`; both columns are independently unique. There is no cross-table exclusion, so a user can have both rows. The existing signup trigger in fact gives the parity admin a teacher row. Role resolution queries both mappings and preserves admin-first precedence: admin row means `admin`, otherwise teacher row means `teacher`, otherwise no application role. No email or user-editable metadata participates in authorization, and no disabled/inactive profile state exists in the schema.

Repository methods are `getTeacherIdentity`, `getAdminIdentity`, `resolveRole`, `getTeacherHeaderProfile`, `getTeacherProfile`, `getAdminDisplayProfile`, `countTeachersForAdmin`, and `listTeachersForAdmin`. Authorization operations return only IDs or a role marker. UI projections contain only currently displayed name/school/phone/joined fields. They never return Auth records, passwords, payment/exam data, Storage paths, or other private domains.

Migrated callers are the central `getUserRole` helper; teacher layout, dashboard, profile, and transaction pages; admin layout, dashboard teacher count, and teacher listing; exam-generation teacher validation; Phase 3/4 exam repository context construction; and payment actor/entitlement teacher resolution. All 12 prior direct teacher reads and both prior direct admin reads moved. The one remaining literal `teachers` call is the existing profile update and remains classified as a write.

The Supabase adapter retains explicit projections, `user_id` filters, `maybeSingle` behavior, the profile page's existing `single` behavior, exact count, and descending teacher-list order. The PostgreSQL adapter uses explicit columns and parameterized UUIDs under the existing transaction-local authenticated identity. RLS therefore limits teacher self-reads and admin-table visibility exactly as before. Admin-only teacher count/list methods additionally verify existing `public.is_admin()`; they use no trusted/service role, superuser, Pool exposure, or RLS bypass.

Cross-role tests cover Teacher A/B isolation, teacher-to-admin denial, unknown identity, raw unauthenticated denial, the current dual-role admin, admin-first precedence, nullable profile fields, uniqueness constraints, admin-only list/count behavior, and parity between application admin resolution and `public.is_admin()`. Admin users retain a teacher mapping where the existing trigger created one, but role-gated teacher routes/actions continue to see the resolved `admin` role and reject or redirect them exactly as before.

Supabase login, signup, logout, password recovery/reset, session cookies, callback exchange, middleware validation, and user creation remain unchanged. The phase migrates no Auth API, teacher/admin mutation, payment table, Storage operation, or production data.

Using the reconciled Phase 5 source-occurrence method, fallback adapter calls increase from 34 to 41 while direct runtime reads fall from 32 to 18; writes remain 31. The seven new fallback calls replace all 14 direct teacher/admin reads, so literal `.from()` totals fall from 97 to 90. Auth API calls remain 19, Storage calls remain four, and dynamic maintenance reads remain four. Remaining direct runtime reads are `app_settings` 1, `exams` 2, `payments` 6, `textbooks` 4, and `textbook_documents` 5.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Before checkpoint, remove only Phase 6 worktree changes; after checkpoint, revert only its reviewed commit. No Auth, schema, or production rollback is required.

The recommended next database slice is the remaining non-payment textbook and textbook-document read boundary, separating public catalog validation from private ready-document checks while leaving Storage and every ingestion mutation unchanged. Payment and `app_settings` should remain deferred to their own security-critical phase.

## CRUD Phase 5: admin reporting and dependency reads

Phase 5 adds the narrow, server-only `lib/admin-reporting` repository. Its operations are `countDashboardExams`, `getSubjectDependencies`, `getGradeDependencies`, `countExamsReferencingSubStrand`, and `listTextbookMetadata`. They cover only the existing dashboard exam count, subject/grade deletion dependency inspection, saved-exam references checked before sub-strand deletion, and the textbook catalog metadata shown on the admin textbook page.

The factory independently validates the current Supabase Auth user and current admin role before returning either adapter. It accepts no user ID, admin ID, role, request object, header, cookie, form value, or backend argument. The PostgreSQL adapter uses the server-derived user UUID in the existing authenticated transaction context and adds `public.is_admin()` to every query. Consequently, even direct internal construction with a teacher or unknown UUID produces no reporting rows; the application factory rejects those identities before query execution. No trusted/service-role or raw Pool capability is exposed.

The Supabase adapter retains exact PostgREST counts (`count: "exact", head: true`), filters, JSON containment behavior, textbook relations, and deterministic name ordering. The PostgreSQL adapter uses `count(*)`, explicit textbook/join columns, parameterized UUIDs and JSONB, existing indexed foreign-key filters, and the same null/zero result normalization. Dashboard reporting counts rows without loading exam JSON, marking schemes, payment details, or other private content. Textbook results contain only ID, name, nullable publisher, and subject/grade display names; `storage_path`, document metadata, chunks, and file content are excluded.

The migrated call sites are `app/admin/page.tsx` for the exam count, `deleteSubject` and `deleteGrade` in `app/actions/admin.ts` for their three dependency counts, `deleteSubStrand` for its saved-exam UUID reference count, and `app/admin/textbooks/page.tsx` for textbook catalog metadata. Every protected call still follows Supabase Auth, server-side admin validation, then repository access. The existing delete actions also retain their own `withAdmin` check before dependency inspection and keep the actual Supabase `.delete().select("id")` mutations unchanged.

Deferred admin reads are intentional: dashboard teacher count is a teacher-profile read; dashboard revenue is a payment read; the teacher listing and admin display name are profile reads; textbook document processing/file metadata remains on its existing service-only path; settings remain on their existing admin policy; and all payment, Auth, Storage, import, and maintenance reads remain untouched. Admin marking-scheme access is not added.

Contract tests cover exact/zero count normalization, filters, metadata shape, environment-only backend selection, server-only imports, admin reauthorization, and absence of trusted/browser-selected authority. Disposable PostgreSQL fixtures cover multiple grades, subjects, active/inactive curriculum rows, textbooks, two teachers' exams, JSON topic references, zero dependencies, textbook ordering/null publisher behavior, admin access, teacher denial, unknown-user denial, and denial without transaction identity. No production data is queried.

The dependency inventory uses one reproducible source-occurrence rule: count each literal `.from("table")`/`.from('table')` database-builder call once in non-test `app`, `lib`, and `scripts` sources. Nested relation names inside `.select()` do not add calls. A mutation followed by `.select()` is classified once as a write. Auth API and Storage calls are separate, and dynamic maintenance `.from(table)` calls are excluded from runtime.

Recounting both Git states with that rule corrects the earlier Phase 4 narrative, which mixed narrower subsets: the Phase 4 checkpoint has 28 fallback-adapter calls, 39 runtime reads outside abstractions, and 31 writes (98 literal calls total), not 29 and 25. The Phase 5 worktree has 34 fallback calls, 32 direct runtime reads, and 31 writes (97 total). Phase 5 added six Supabase fallback calls and removed seven direct runtime calls; no unexplained read was introduced. Four dynamic maintenance/tooling database reads exist in both states outside those literal totals.

After Phase 5, remaining direct runtime reads by table are: `teachers` 12, `admins` 2, `app_settings` 1, `exams` 2, `payments` 6, `textbooks` 4, and `textbook_documents` 5. There are no remaining direct runtime reads for grades, subjects, curriculum hierarchy tables, or marking schemes. Auth has 19 explicit API calls and Storage has four explicit bucket calls; neither is part of the `.from()` totals.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Before checkpoint, remove only the Phase 5 worktree changes; after checkpoint, revert only its reviewed commit. No schema, production-data, payment, Auth, or Storage rollback is required.

The recommended next database slice is a separately reviewed read-only teacher/admin profile and role-resolution layer, keeping Supabase Auth as the session authority and avoiding payment, Storage, and all writes. Because role resolution is security-critical, it should have explicit teacher/admin cross-role and unauthenticated tests before any call-site migration.

## CRUD Phase 4: authorized exam document and detail reads

Before Phase 4, `loadCanonicalExamDocument` authenticated the user, resolved teacher/admin role, loaded the complete exam JSON plus nested marking JSON, checked ownership/admin access, and only then checked payment entitlement when serving a PDF. Teacher detail and marking pages subsequently checked entitlement to decide whether to show payment controls and download/print controls. Those pages intentionally rendered an unpaid preview; PDFs were paid-only. Admin users were redirected away from teacher pages, while the API loader allowed admin exam access. Existing RLS allowed admins to read exams but did not grant admin marking-scheme access.

Phase 4 preserves those effective contracts while splitting the repository boundary into `getDocumentAccessMetadata(id)` and `getAuthorizedExamDocument(id, includeMarking)`. Metadata contains only `id`, `status`, and `revision`; it contains no exam JSON, marking JSON, payment, provider, phone, AI, textbook, or Storage data. The private query returns only the fields required by `buildExamDocument`, and student document reads do not query marking schemes.

The new sequence is authentication, server-side role/teacher resolution, metadata authorization, optional existing payment entitlement, private content load, canonical content validation, and rendering. Teacher detail and marking pages do not request the paid-only option, preserving their existing unpaid preview behavior. The PDF route still passes `requirePaid: true`, so its sequence is now authorization metadata, the unchanged payment subsystem, then private JSON. Both student and marking PDFs retain Node runtime, dynamic execution, bounded output, and private `no-store` headers.

Teacher access continues to derive `teacher.id` from the authenticated Supabase user and applies both RLS identity and an explicit `exam.teacher_id` predicate to metadata, exam content, and parent-constrained marking queries. Foreign-owned and nonexistent exams both produce the same not-found result. There is no standalone marking-scheme identifier operation. Admin selection remains a separate server-derived role path: it relies on the existing admin RLS policy for exams and does not invent an admin flag or a teacher-method bypass. Because existing RLS has no admin marking-scheme policy, admin marking documents remain unavailable exactly as before.

The Supabase adapter retains explicit PostgREST projections and nested marking syntax only when marking content is requested. The PostgreSQL adapter uses explicit columns, parameterized UUIDs, authenticated transaction identity, and fixed role-derived query branches. It exposes no Pool, SQL, trusted transaction, service role, or browser-selected backend/role.

Synthetic contract and PostgreSQL integration tests cover metadata minimization, student-versus-marking projections, draft/generated/paid states, revision and null-year behavior, Teacher A/B cross-owner denial, missing rows, unauthenticated denial, admin exam behavior, and existing admin marking behavior. The paid fixture is produced through the existing begin/finalize payment RPC path rather than by directly forging entitlement state. Static sequencing tests prove the paid PDF entitlement call precedes private loading. Existing payment and Daraja suites remain the authority for callback, STK acceptance, trusted finalization, amount/currency, receipt/reference uniqueness, idempotency, cooldown, quota, lease, and backoff behavior.

Deferred reads remain the payment subsystem's own exam/payment lookups, payment initiation ownership check, admin dashboard/dependency reads, and transaction-history nested exam label. No write or payment-table migration is included.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Before checkpoint, remove only Phase 4 worktree changes; after checkpoint, revert only that reviewed commit. No schema, payment, auth, Storage, or production-data rollback is required.

The recommended next database slice is a separately reviewed read-only admin reporting/dependency layer, keeping teacher-owned repositories distinct and leaving payment tables, Auth, and Storage unchanged.

## CRUD Phase 3: teacher-owned exam and marking-scheme reads

Phase 3 adds the narrow, server-only `lib/exam-read` repository. Its three operations are `listRecentTeacherExams(limit)`, `listTeacherExams()`, and `getTeacherExamForEditing(id)`. The first two are deliberately metadata-only. They do not return exam JSON, marking content, payment data, phone numbers, provider references, or receipts. The editor projection returns exam JSON and marking content because the existing editor and regeneration validation require both.

The migrated runtime callers are the teacher dashboard recent list, teacher exam history list, teacher edit page, and the canonical pre-read shared by editor save and question regeneration. Each repository context first validates the current Supabase Auth user and derives `teacher.id` from `user.id` on the server. Neither identity, `DATABASE_BACKEND`, nor a PostgreSQL role is accepted from a page, action argument, header, cookie field, or request body. The Supabase adapter retains PostgREST relations and ordering while adding an explicit server-derived `teacher_id` filter in addition to RLS.

The PostgreSQL adapter runs under the existing transaction-local authenticated identity. Every exam query also contains `teacher_id = $n::uuid`; marking content is selected only by joining its parent exam and repeating that ownership predicate. List joins use explicit grade/subject name projections and deterministic descending `created_at` ordering. The editor's exam and scheme reads share one transaction, so they cannot observe different committed revisions. No method accepts a marking-scheme ID, which prevents a standalone scheme identifier from bypassing parent ownership.

Foreign-owned and missing editor exams both normalize to `null`, preserving the current non-enumerating page/action behavior. Invalid route IDs continue to be rejected before repository access by the existing UUID checks. Paid/downloaded editor locking, editable-content validation, revision requirements, stale-revision rejection, atomic save, and regeneration leases remain unchanged; all persistence stays on the reviewed RPC abstraction.

The shared exam-document loader is intentionally deferred. It combines teacher/admin authorization, full private document content, marking-scheme rendering, and the PDF payment entitlement boundary. Payment initiation and entitlement pre-reads are likewise deferred with all `payments` access. The admin dashboard count and admin dependency checks remain Supabase-backed because their privileged semantics differ from teacher ownership. Consequently this phase changes no PDF, payment, Daraja, admin, or document-detail behavior.

Contract tests verify the default/environment-only backend, exact Supabase projections, explicit ownership filters, ordering, limits, nullable year behavior, missing rows, and server-only construction. Disposable PostgreSQL integration fixtures cover two teachers, draft/generated/paid/downloaded states, multiple revisions and dates, grade/subject labels, marking schemes, list data minimization, symmetric cross-teacher denial, unauthenticated denial, missing IDs, and malformed UUID failure. Synthetic content only is used.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Before checkpoint, remove only the Phase 3 worktree changes; after a reviewed checkpoint, revert only that commit. No schema, data, payment, auth, or storage rollback is required.

The recommended next slice is a separately reviewed document/detail read phase that first separates lightweight authorization and entitlement checks from private content loading, with distinct teacher and admin contracts. It should not migrate payment tables or writes. If that boundary cannot be isolated cleanly, migrate another low-risk read domain instead.

## CRUD Phase 2: curriculum hierarchy reads

Phase 2 moves runtime reads of `strands`, `sub_strands`, `learning_outcomes`, and `strand_objectives` behind the server-only `lib/curriculum-read` repository. It does not migrate any curriculum mutation, verified-curriculum import execution, import history, legacy preservation table, or source-exception table.

The repository methods are `listActiveGradeIds`, `listSubjectContextsForGrade`, `listActiveHierarchy`, `getSelectionTopics`, `listAdminHierarchy`, the scoped strand/sub-strand/outcome name and parent lookups used by existing admin validation, and the three child/dependency counts. The API exposes no arbitrary table, projection, SQL, database role, Pool, or trusted execution method.

Migrated callers are the wizard's active-grade, available-subject, and active-hierarchy loaders; server-authoritative curriculum selection loading in exam generation; the admin curriculum hierarchy page; and curriculum dependency, parent, and duplicate reads inside existing admin write actions. The browser wizard now calls validated server actions and no longer imports a Supabase browser client. Grade/subject selection, textbook loading, exam persistence, and every neighboring table remain on their previously reviewed paths.

The Supabase adapter retains the original PostgREST projections, nested relationship syntax, filters, and modern-to-legacy admin read fallback. The direct PostgreSQL adapter uses explicit projections and parameterized UUIDs inside the existing authenticated transaction context. Nested results are assembled deterministically in TypeScript from scoped parent and child queries. A sub-strand can only be assembled under a returned strand; learning outcomes only under returned sub-strands; and strand objectives only under returned strands.

Active behavior is unchanged: wizard and admin hierarchy methods return active roots only, while `getSelectionTopics` can resolve an inactive selected parent so the existing generation validator can reject it explicitly. Verification status, outcome status, source code/reference, sort order, UUID, and null values remain distinct. `source_metadata` and `curriculum_import_id` are not returned because no migrated runtime consumer uses them.

CBC and Form semantics remain separate. CBC learning outcomes stay attached to sub-strands. Form topic objectives stay attached to `strand_objectives`; they are never fabricated as learning outcomes. Generation continues to choose the existing objective scope based on which authoritative records are actually present.

All curriculum tables are readable to the existing authenticated role under current policies, while route-level boundaries remain intact: the teacher path checks the user and teacher record before selection loading; admin pages retain their admin layout; and admin actions run `withAdmin` before repository access. Server actions validate UUID inputs and accept no user ID, backend, or PostgreSQL role.

Synthetic contract tests cover two grades, two subjects, active/inactive and verified/unverified strands, multiple ordered children, null sources, CBC outcomes, Form objectives, mismatched scopes, invalid IDs, empty results, hierarchy assembly, and denial of raw unauthenticated reads. The original assessment, blueprint, Security B1, RPC, payment, editor, and RAG suites remain regression gates.

At this checkpoint, `.from()` source occurrences split into 24 fallback-adapter calls (11 catalog and 13 curriculum), 48 runtime database reads outside abstractions, 6 maintenance/tooling calls, 31 retained database writes, and 4 Storage calls. These are source-level occurrences; dynamic maintenance helpers may represent multiple table operations.

Rollback remains configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Before checkpoint, remove only the Phase 2 worktree changes; after a reviewed checkpoint, revert only that commit. No schema or production data rollback is required.

The recommended next database slice is a separately audited read-only exam/marking-scheme view layer, beginning with teacher-owned list/detail reads and preserving RLS ownership and paid-content boundaries. Do not combine it with writes, Better Auth, payments, or Storage.

## CRUD Phase 1: grades and subjects

`lib/catalog` is a narrow, server-only repository for the existing grades/subjects read shapes. It does not expose arbitrary tables, SQL, the PostgreSQL Pool, trusted RPC execution, or write methods. The methods are `listWizardGrades`, `listGradesByCreation`, `listGradeOptionsByName`, `listGradeNames`, `getGradeById`, `gradeExists`, `listSubjectsByName`, `listSubjectNames`, `getSubjectById`, `subjectExists`, and `countSubjects`.

The Supabase implementation retains the original explicit projections, filters, null normalization, and ordering. The PostgreSQL implementation uses the existing bounded pool and authenticated transaction helper with explicit columns. Its SQL is limited to `public.grades` and `public.subjects`; ID lookups use `$1::uuid`, and no query uses `SELECT *`.

Both tables are globally readable to the current `authenticated` role under the existing `grades_select_all` and `subjects_select_all` policies. They are not anonymous/public catalog endpoints. `getCatalogRepository()` first validates the current Supabase session with `auth.getUser()` and accepts no caller-provided user ID, role, backend, request, headers, cookies, or form data. The direct adapter receives only the server-derived `user.id`. Admin and teacher route guards remain unchanged, and the repository has no trusted/service-only capability.

Migrated runtime reads are:

- wizard grade loading in `components/exam-wizard/exam-wizard.tsx`, now through `app/actions/catalog.ts`; the neighboring strands browser query is unchanged;
- grade and subject validation in `app/actions/exams.ts`;
- grade/subject lists in the admin grades, subjects, curriculum, and textbook pages;
- the admin dashboard subject count;
- duplicate/existence reads used by subject and grade create/update actions (the writes remain Supabase);
- grade/subject existence validation for textbook creation (all textbook reads/writes and Storage remain Supabase).

Contract tests verify the default Supabase selection, exact Supabase projections/order, wizard `sort_order` null normalization, environment-only backend choice, and the server-only authenticated boundary. Direct PostgreSQL integration tests use only synthetic parity-container data and verify field shapes, ordering, unique/empty behavior, ID parameters, counts, and denial to a connection without authenticated identity.

Maintenance-only curriculum audit/import scripts retain their existing service-path reads. The delete mutations' `.select("id")` return clauses are writes and are also intentionally unchanged. All other ordinary `.from()` calls—including strands, curriculum hierarchy, textbooks/documents/chunks, exams, payments, teachers/admins, settings, and AI reservations—remain out of scope.

Rollback is configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Before checkpoint, discard only the reviewed CRUD Phase 1 files/hunks; after checkpoint, revert only that commit. No database rollback is required because this phase adds no schema or production-data changes.

The recommended next CRUD slice, after review and checkpoint, is read-only strands/sub-strands/learning outcomes as a separate curriculum repository. It should preserve active-state filters, nested result normalization, authenticated access, and current ordering. Do not combine that slice with writes, Better Auth, or Storage.

## Design

The abstraction is intentionally narrow: `AuthenticatedRpcDatabase` contains the one authenticated-user RPC, while `TrustedRpcDatabase` contains the 12 existing service-only operations. Callers select business methods, never arbitrary function names, SQL, database roles, or backend names. `lib/db/index.ts` is the server-only factory.

`pg` was chosen instead of Drizzle because the business invariants already live in tested PostgreSQL functions using row/advisory locks, atomic transactions, RLS, JSONB, and pgvector. This phase replaces transport without redesigning those functions or introducing a second schema model.

## Backend selection

`DATABASE_BACKEND` accepts only `supabase` or `postgres`:

- missing or `supabase`: existing Supabase/PostgREST RPC transport;
- `postgres`: parameterized node-postgres calls to the same function signatures.

The default is deliberately `supabase`, so deployment behavior does not change unless a server operator explicitly opts in. Backend selection is read only from server environment configuration and is not accepted from actions, routes, forms, query strings, or other browser-controlled values.

## Environment variables

```dotenv
DATABASE_BACKEND=supabase
DATABASE_URL=
```

`DATABASE_URL` is required only for the PostgreSQL backend. It is server-only and must never use a `NEXT_PUBLIC_` prefix. `.env.example` contains placeholders only. The local parity example contains synthetic disposable credentials; no production URL is committed.

## Direct PostgreSQL pool

`lib/db/postgres-client.ts` owns a development/HMR-safe global `pg.Pool` singleton. It has a maximum of 10 connections, a 5-second connection timeout, 30-second idle timeout, 30-minute connection lifetime, and 15-second query/statement timeouts. Each identity-bearing operation also applies a 10-second idle-in-transaction timeout. Connections are always released, failed transactions roll back, production signal handlers close the pool, and tests can explicitly close it.

The Pool is never exported through a client component or public endpoint. The URL is read only while constructing the server pool; credentials and query parameters are never logged.

## Identity and RLS propagation

Authenticated work uses one short transaction:

```text
BEGIN
SET LOCAL ROLE authenticated
set_config('request.jwt.claim.sub', validated Supabase user UUID, true)
set_config('request.jwt.claim.role', 'authenticated', true)
...parameterized operation...
COMMIT
```

The user UUID comes from the existing server-side `supabase.auth.getUser()` session validation, not from the browser action arguments. This matches the current compatibility `auth.uid()` and `auth.role()` implementations. Values use query parameters, and the role name is a fixed SQL literal.

The trusted factory is separate. It uses only the fixed `service_role` and its fixed local claim inside a transaction. No public API accepts a role or chooses between authenticated and trusted execution. This preserves current EXECUTE restrictions: an authenticated transaction cannot call service-only functions, and a connection without an explicit identity role cannot call the authenticated function.

The local harness adds `exam_app_runtime`, a non-superuser `NOINHERIT` login used only for integration testing. It may enter the two compatibility roles because this transition is still an interim Supabase-compatible boundary. A later reviewed role-hardening phase should replace the broad compatibility `service_role`/`BYPASSRLS` model with purpose-specific runtime roles; the application login must not become a superuser.

## The 13 operations

| Typed method | PostgreSQL function | Boundary |
|---|---|---|
| `importVerifiedCurriculum` | `import_verified_curriculum(jsonb)` | trusted |
| `listReadyTextbooks` | `list_ready_textbooks(uuid, uuid)` | authenticated |
| `matchTextbookChunks` | `match_textbook_chunks(uuid, vector(2048), integer, uuid)` | trusted |
| `updateExamAndSchemeAtomic` | `update_exam_and_scheme_atomic(uuid, uuid, integer, jsonb, jsonb)` | trusted |
| `claimAiGeneration` | `claim_ai_generation(uuid, uuid)` | trusted |
| `claimAiRegeneration` | `claim_ai_regeneration(uuid, uuid, text, uuid, integer)` | trusted |
| `persistGeneratedExam` | `persist_generated_exam_and_complete_ai_operation(uuid, uuid, uuid, uuid, uuid, text, integer, integer, text, text, integer, jsonb, jsonb)` | trusted |
| `persistRegeneratedExam` | `persist_regenerated_exam_and_complete_ai_operation(uuid, uuid, uuid, uuid, text, integer, jsonb, jsonb)` | trusted |
| `failAiOperation` | `fail_ai_operation(uuid, uuid)` | trusted |
| `beginPaymentAttempt` | `begin_payment_attempt(uuid, uuid, text, text, uuid)` | trusted |
| `acquirePaymentQueryLease` | `acquire_payment_query_lease(uuid, uuid)` | trusted |
| `completePaymentQueryLease` | `complete_payment_query_lease(uuid, uuid)` | trusted |
| `finalizeVerifiedPayment` | `finalize_verified_payment(uuid, uuid, uuid, text, integer, text, text, text, text, text)` | trusted |

## Implementations and normalization

The Supabase adapter retains `.rpc()` with the exact existing named arguments. The PostgreSQL adapter uses schema-qualified, positional, parameterized `SELECT` statements with explicit casts matching the migration signatures. JSON values remain JSONB, vectors remain 2048-dimensional pgvector literals, null defaults remain null, and table-returning functions remain row arrays.

Both adapters expose the same application-level shapes: arrays for textbook/claim/vector results, one payment row for `beginPaymentAttempt`, scalars for UUID/revision/boolean functions, and a normalized `DatabaseRpcError` containing the safe PostgreSQL/PostgREST code and message required by editor stale-revision handling.

The browser textbook RPC moved to an authenticated server action. Remaining Supabase `.from()` calls, session/auth calls, and Storage calls are intentionally unchanged.

## Tests and security evidence

The Supabase contract test verifies the default backend and all 13 exact RPC mappings without production access. The PostgreSQL integration test uses synthetic fixtures in the disposable parity database and verifies:

- all 13 methods, including negative curriculum input;
- generation/regeneration acquisition, atomic persistence, failure, and revision behavior;
- editor ownership and stale/incorrect-owner rejection;
- payment initiation, lease acquisition/completion, trusted correlation, finalization, and mismatch rejection;
- deterministic 2048-dimensional vector retrieval;
- Teacher A can see an owned exam while Teacher B cannot;
- an unauthenticated connection cannot execute the authenticated textbook function;
- an authenticated transaction cannot execute a service-only function;
- backend/role selection is not exposed as a browser-controlled argument.

The original parity harness remains the authoritative full Security B1, RLS, pgvector, and concurrency suite.

## Local commands

```bash
bash ./infra/self-hosted/run-parity-tests.sh
DATABASE_BACKEND=supabase node --conditions react-server --test --experimental-strip-types lib/db/rpc-contract.test.ts
DATABASE_BACKEND=postgres DATABASE_URL='postgresql://exam_app_runtime:local-parity-runtime-only@127.0.0.1:55432/exam_generator_parity' \
  node --conditions react-server --test --experimental-strip-types lib/db/postgres-rpc.integration.test.ts
```

Some nested/containerized development hosts do not activate Docker's loopback proxy even when the binding is configured. In that environment only, obtain the disposable container's private address with `docker inspect` and substitute it for `127.0.0.1:55432`. Never substitute a production Supabase database URL.

## Remaining Supabase dependencies

Supabase remains the default RPC transport and still supplies authentication/session cookies, all ordinary `.from()` CRUD, browser curriculum reads, admin helpers, private Storage, password recovery, and production database hosting. The payment repository is intentionally hybrid under the PostgreSQL RPC option: only its four RPC calls use the abstraction while ordinary row reads/updates remain Supabase in this phase.

## Rollback and next step

Rollback is configuration-first: unset `DATABASE_BACKEND` or set it to `supabase`. Before a checkpoint commit, all changes are ordinary worktree edits. After a checkpoint, revert only that reviewed commit; do not reset unrelated work. No production database rollback is needed because this phase performs no production writes or migrations.

After review and checkpoint, the next recommended step is a separate, low-risk ordinary-CRUD repository phase, beginning with a server-only read path and explicit authorization parity. Do not begin Better Auth or Storage migration until CRUD/RLS coverage and least-privilege runtime-role design are separately reviewed.

## Auth Phase 1: Better Auth foundation (parallel, not cut over)

Auth Phase 1 adds a self-hosted Better Auth foundation without changing the current authentication authority. `AUTH_BACKEND` accepts `supabase|better-auth` and defaults to `supabase`, but existing signup, login, logout, recovery, middleware, session lookup, and role-resolution call sites remain on Supabase during this phase. There is no user import, session migration, FK repoint, or production cutover.

The target Better Auth data lives in an isolated `better_auth` PostgreSQL schema with `users`, `sessions`, `accounts`, and `verifications`. IDs are UUIDs and may be supplied explicitly, which is required to preserve existing Supabase `auth.users.id` values during the later migration. Credential identity is represented through the account table; sessions and accounts cascade from the Better Auth user. The existing temporary/self-hosted Supabase-compatible `auth.users`, `auth.uid()`, `teachers.user_id`, `admins.user_id`, and `textbook_documents.uploaded_by` relationships are intentionally unchanged.

The Better Auth runtime options use PostgreSQL with `search_path=better_auth,public`, database-backed sessions, email/password authentication, UUID ID generation, and explicit snake-case mappings. The Better Auth factory/database initialization remains inert while `AUTH_BACKEND=supabase`; enabling Better Auth additionally requires `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, and the reviewed `better-auth` runtime package. The reviewed Better Auth and bcrypt dependencies were subsequently installed and lockfile-pinned in the networked development checkout before later Auth phases were checkpointed.

Supabase password hashes are bcrypt while Better Auth defaults to scrypt. Phase 1 therefore does not pretend those hashes are interchangeable. The password-migration helper only detects validated bcrypt hash shapes and delegates verification to a real bcrypt implementation. Before any real import, install/test the bcrypt verifier recommended by Better Auth's Supabase migration guide against synthetic and exported staging hashes. New-user/password hash policy and any optional bcrypt-to-scrypt upgrade-on-login mechanism belong to the migration rehearsal phase, not this foundation.

The self-hosted parity bootstrap applies the isolated auth foundation after the existing application migrations. It does not alter production Supabase. Synthetic contract coverage checks backend defaults, Better Auth isolation, PostgreSQL/UUID configuration, schema/FK isolation, and bcrypt delegation. A PostgreSQL integration test is provided for UUID preservation, duplicate email rejection, database sessions, credential accounts, and verification expiry when the disposable parity database is available.

Rollback is simple: keep or restore `AUTH_BACKEND=supabase`; no current auth call site uses Better Auth yet. Removing the isolated `better_auth` schema from a disposable/staging target does not affect existing application identity rows. The next Auth phase should install/lock the Better Auth package, mount/test the staging handler, introduce a session/identity abstraction, and only then migrate individual auth flows. Supabase Auth must remain available until synthetic user migration, password verification, UUID/FK parity, recovery, RLS identity, and rollback are proven in staging.

## Auth Phase 2: backend-aware session and identity boundary

Auth Phase 2 moves protected server-side identity lookup behind `lib/auth-backend` while keeping all interactive authentication flows on Supabase. `AUTH_BACKEND` still defaults to `supabase`. Signup, login, logout, password recovery/update, the PKCE callback, and proxy session refresh are intentionally unchanged; no production user is imported and no existing auth/session cookie is cut over in this phase.

The application-level authenticated-user contract is deliberately minimal: validated UUID `id` plus nullable `email`. The Supabase adapter derives that contract only from `supabase.auth.getUser()`. The Better Auth adapter derives it only from `auth.api.getSession({ headers })`, which performs the Better Auth server-side session validation against its database-backed session model. Identity is never accepted from form data, query parameters, request bodies, or unsigned application cookies. Malformed/non-UUID Better Auth user IDs are rejected before they can become PostgreSQL transaction-local identity.

`getCurrentUser()` now delegates to the backend-aware resolver. Identity/profile resolution, authenticated RPC construction, catalog reads, curriculum reads, exam/document reads, and exam generation authentication use the same server-derived identity boundary. Existing admin-first role precedence remains in the identity repository (`admin -> teacher -> null`), so dual-role accounts continue to resolve as admins. PostgreSQL repositories continue to receive only the validated auth UUID and execute through the existing authenticated transaction helper, which recreates the temporary `auth.uid()` compatibility context for RLS.

A Better Auth session cannot safely authorize the legacy Supabase Data API because Supabase cannot validate Better Auth cookies. Therefore `AUTH_BACKEND=better-auth` is fail-closed for protected Data API repository fallbacks and requires `DATABASE_BACKEND=postgres` for protected database access. This is intentional migration behavior, not a weakening of RLS. Supabase remains a valid fallback only while Supabase Auth is also the active session authority.

Synthetic contract tests cover UUID/email normalization, environment-only backend selection, Better Auth `getSession` usage, rejection of browser-supplied identity shapes, transaction-local PostgreSQL identity, Supabase-default preservation, and the fail-closed Better-Auth-plus-Supabase-Data-API combination. Existing Supabase auth actions and middleware remain frozen for the next flow-migration phases.

Rollback remains configuration-first: keep `AUTH_BACKEND=supabase`. Phase 2 does not repoint `teachers.user_id`, `admins.user_id`, or `textbook_documents.uploaded_by`, does not migrate passwords or sessions, and does not modify production data. The next Auth phase should migrate login/signup/logout behind the backend boundary in staging while leaving password recovery and final user import/cutover separate.

## Auth Phase 3: backend-aware credential mutations (staging foundation)

Auth Phase 3 moves signup, password login, and logout behind the existing `lib/auth-backend` boundary. `AUTH_BACKEND` still defaults to `supabase`, so the default runtime preserves the historical Supabase calls, signup metadata (`name`, `school`, `phone`), email-confirmation result, login role gate, and logout redirect. Password recovery/update, the PKCE callback, and middleware/session refresh remain explicitly Supabase-owned and are not cut over in this phase.

The Better Auth credential adapter is enabled only when `AUTH_BACKEND=better-auth` **and** `DATABASE_BACKEND=postgres`. It uses Better Auth's server-side `signUpEmail`, `signInEmail`, and `signOut` APIs with request headers, and the Next.js cookie plugin is configured so credential responses can propagate database-backed session cookies from Server Actions. The returned user is still normalized to the minimal validated UUID/email contract before application role resolution. A successful login resolves role from that returned validated user directly, avoiding any trust in form data or a just-written cookie. If no application profile exists, the adapter revokes the exact session token created by that login before returning the existing unknown-profile error.

Application ownership FKs still reference the temporary/self-hosted `auth.users` compatibility table, not `better_auth.users`. Therefore Phase 3 includes a deliberately temporary bridge for **new Better Auth signups only**: after Better Auth has durably created the credential user, the server confirms that exact UUID/email in `better_auth.users`, then inserts the same UUID plus signup metadata into `auth.users` inside the existing trusted transaction. The existing `handle_new_user` trigger creates the teacher profile, preserving the current ownership graph without inventing or remapping IDs. The bridge grants `service_role` only `SELECT` and `INSERT` on `auth.users`; `UPDATE` and `DELETE` are explicitly revoked. `SELECT` is used only to verify an ambiguous bridge outcome before any compensation. No application FK is repointed in this phase.

Signup uses defense-in-depth around the cross-system bridge. A case-insensitive Better Auth email precheck avoids a known duplicate path; the returned UUID/email is verified against the canonical Better Auth user table before any application identity row is created; an unavailable persistence check is treated as ambiguous and never triggers destructive cleanup; and if bridge provisioning fails, the server first checks whether the same UUID plus trigger-created teacher profile actually committed. Only a confirmed-absent bridge is eligible for best-effort Better Auth compensation; an unverifiable/ambiguous state is left intact for reconciliation rather than risking deletion of a valid identity. Existing Supabase-only users are **not** silently imported by this phase; bulk UUID/password-hash migration remains a separate staging rehearsal/cutover step.

Phase 3 is intentionally not a complete Better Auth UI cutover. Because middleware remains Supabase-owned, `AUTH_BACKEND=better-auth` must not be enabled for production traffic yet; mutation-level staging tests can validate credential creation/session behavior while the next phase migrates middleware/session refresh and route protection. Rollback remains configuration-first: keep `AUTH_BACKEND=supabase`. Production Supabase Auth, production data, password recovery, and existing user sessions are untouched.

## Auth Phase 4: backend-aware password recovery and reset

Auth Phase 4 moves password-reset request/completion behind the existing `lib/auth-backend` boundary while preserving `AUTH_BACKEND=supabase` as the default. Supabase keeps its historical PKCE flow: `resetPasswordForEmail()` targets `/auth/callback`, the callback exchanges the code for a validated recovery session, sets the short-lived HTTP-only `auth-recovery` cookie, and the Supabase adapter requires that cookie plus `getUser()` before `updateUser({ password })`, sign-out, and cookie deletion.

When `AUTH_BACKEND=better-auth`, recovery requires `DATABASE_BACKEND=postgres` and uses Better Auth's server-side `requestPasswordReset` / `resetPassword` APIs. Better Auth redirects valid recovery links directly to `/reset-password?token=...`; the token is treated only as the one-time credential-reset capability and never as an application user ID, role, or database authorization claim. Invalid/missing tokens fail closed. Password reset tokens expire after one hour and `revokeSessionsOnPasswordReset` is enabled so an accepted reset invalidates existing Better Auth sessions before the user signs in again.

Better Auth recovery email delivery uses a provider-neutral SMTP boundary via Nodemailer rather than another required SaaS API. `SMTP_URL` and `AUTH_EMAIL_FROM` are server-only; production `smtp://` connections require STARTTLS while `smtps://` uses implicit TLS. Reset URLs are checked against `BETTER_AUTH_URL` before sending and reset tokens/recipient addresses are not written to application logs. The request UI keeps the same anti-enumeration message whether or not the submitted email exists. SMTP configuration is validated before starting a Better Auth recovery request; asynchronous delivery failures are logged without exposing the account address or reset URL.

The legacy `/auth/callback` route is backend-aware. Under Better Auth it refuses to exchange Supabase PKCE codes and redirects to an invalid-link reset state. Under Supabase it preserves the existing code-exchange/cookie behavior. Middleware/proxy session refresh remains Supabase-owned in Phase 4, so Better Auth is still a staging-only opt-in and must not be enabled for production traffic yet.

Phase 4 adds a disposable PostgreSQL runtime test that creates a Better Auth credential user, captures the generated one-time reset token without sending external email, resets the password, verifies prior sessions are revoked, confirms the old password no longer works, confirms the new password works, and rejects token replay. SMTP network delivery itself requires client-owned staging SMTP credentials and is intentionally not exercised against production infrastructure by the automated test.

Rollback remains configuration-first: keep `AUTH_BACKEND=supabase`. No application identity FK is repointed, no existing Supabase user is imported, no legacy bcrypt verifier is activated, and no production database/Auth/SMTP endpoint is changed in this phase. The next phase should migrate middleware/route protection and Better Auth handler exposure in staging, then rehearse real UUID/password import before final cutover.

### Auth Phase 5 — backend-aware Proxy protection

- Root `proxy.ts` now dispatches through the configured auth backend; missing/default `AUTH_BACKEND` still uses the existing Supabase middleware/session-refresh path unchanged.
- When `AUTH_BACKEND=better-auth`, the existing `/teacher` and `/admin` prefix semantics trigger Proxy authentication. The Proxy performs a full Better Auth database-backed `getSession` validation using the incoming request headers; it does not trust session-cookie existence.
- Better Auth Proxy validation failures fail closed by redirecting protected requests to `/login`. Public routes do not incur a Better Auth database lookup.
- Authorization remains server-side in the admin/teacher layouts and protected repositories. The Proxy proves authentication only; it does not derive roles from cookies, headers, query parameters, or browser input.
- Admin-first dual-role behavior remains unchanged in identity role resolution and the existing layouts.
- This phase does not migrate user rows, repoint `auth.users` foreign keys, remove Supabase Auth, deploy to production, or change password/credential flows introduced in earlier auth phases.

### Auth Phase 6 — UUID-preserving Supabase user import rehearsal

Auth Phase 6 adds **offline/staging import tooling only**. It does not connect to production Supabase, does not repoint application foreign keys, and does not enable Better Auth for production traffic. The import input is an operator-created JSONL export containing only the required Supabase Auth fields: `id`, `email`, `encrypted_password`, confirmation timestamps, created/updated timestamps, and optional `raw_user_meta_data`. That file contains password hashes and is treated as a privileged secret; `*.auth-export.jsonl` is ignored by Git and the import script never logs rows, emails, hashes, metadata, or connection strings.

The importer requires the target self-hosted `auth.users` compatibility row to already exist with the **same UUID and normalized email**. It never inserts, updates, or deletes `auth.users`. This prevents the import rehearsal from accidentally firing the legacy signup trigger or rewriting application ownership. Each Better Auth user is inserted with the exact preserved UUID, and its credential account uses Better Auth's expected `issuer='local:credential'`, `account_id=<same UUID>`, and `provider_id='credential'`. Unsupported/non-bcrypt password material blocks the import rather than silently creating an account that cannot log in.

The import is dry-run by default and `--apply` is explicit. A run is transactional, rejects duplicate UUID/email input, rejects target UUID/email collisions, and is safe to rerun. If an imported bcrypt credential has already been upgraded to Better Auth scrypt by a successful staging login, rerunning the old export preserves the newer scrypt credential instead of overwriting it with stale bcrypt material.

Better Auth's password configuration is migration-compatible without downgrading new passwords: recognized Supabase bcrypt hashes are verified with `bcrypt`, while Better Auth's native scrypt verifier handles Better Auth hashes. New signups and password resets continue hashing with Better Auth scrypt. After a successful imported login, the adapter performs a best-effort compare-and-swap upgrade of that exact bcrypt account hash to scrypt. A concurrent password reset/change wins because the update includes the old hash in its predicate. Upgrade failure does not invalidate an already-successful login; the bcrypt credential remains usable and the upgrade can retry on a later login.

Before any future FK cutover, readiness checks require zero UUID gaps between `auth.users` and `better_auth.users`, zero email mismatches, and zero `teachers.user_id`, `admins.user_id`, or `textbook_documents.uploaded_by` references missing from Better Auth. Phase 6 adds normalized-email uniqueness in `better_auth.users` but intentionally leaves all three application foreign keys on `auth.users`.

Staging rehearsal commands use a privileged offline export and the disposable/self-hosted PostgreSQL target only:

```bash
# Dry run is the default; the export file itself must remain outside source control.
DATABASE_URL='postgresql://...' \
  node --conditions=react-server --experimental-strip-types \
  scripts/import-supabase-auth-export.ts /secure/path/users.auth-export.jsonl

# Apply only after the dry-run counts/collisions are reviewed.
DATABASE_URL='postgresql://...' \
  node --conditions=react-server --experimental-strip-types \
  scripts/import-supabase-auth-export.ts /secure/path/users.auth-export.jsonl --apply
```

The production export itself remains a later controlled cutover operation. When that window arrives, the read-only Supabase export must preserve the exact `auth.users.id`, normalized email, `encrypted_password`, verification state, and timestamps. Active Supabase sessions are not migrated; users must reauthenticate through Better Auth after cutover.

### Auth Phase 7 — manual Better Auth identity/FK cutover rehearsal

Auth Phase 7 adds the **manual, deferred** application-identity cutover required after the Phase 6 UUID/password import is clean. The cutover SQL lives under `infra/self-hosted/auth-cutover/`, is mounted into the disposable/self-hosted database container for operator use, and is intentionally **not** executed by normal bootstrap. This preserves the required production order: restore application data, import the privileged Supabase Auth export, review zero readiness counts, freeze signup/password mutations for the final delta window, and only then repoint identity foreign keys.

The cutover transaction locks the compatibility/canonical identity tables plus the three dependent application tables and fails before DDL if any readiness invariant is non-zero. It requires bidirectional UUID parity between `auth.users` and `better_auth.users`, normalized-email parity for matching UUIDs, and complete Better Auth coverage for `teachers.user_id`, `admins.user_id`, and `textbook_documents.uploaded_by`. The Phase 6 readiness structure now reports Better Auth rows that are missing the historical `auth.users` snapshot as well, so a half-populated target cannot be declared cutover-ready.

When readiness is clean, only the three reviewed application foreign keys move: `teachers.user_id` and `admins.user_id` reference `better_auth.users(id)` with their historical `ON DELETE CASCADE`, while `textbook_documents.uploaded_by` preserves historical `ON DELETE RESTRICT`. Each replacement FK is added `NOT VALID` and explicitly validated inside the cutover transaction. No other ownership relationship, table ID, teacher ID, admin ID, exam relation, payment relation, or textbook/document ID is rewritten.

The temporary Phase 3 signup bridge is retired after the FK switch. The local compatibility `on_auth_user_created` trigger is removed and the temporary `service_role` `SELECT`/`INSERT` rights on `auth.users` are revoked. The compatibility table itself is deliberately retained as a migration snapshot/rollback aid for the acceptance window; Phase 7 does not drop the `auth` schema, `auth.users`, or the `auth.uid()` compatibility helper.

Application signup provisioning is migration-aware. Before the manual cutover, Better Auth signup still mirrors the exact Better Auth UUID plus signup metadata into `auth.users`, allowing the historical trigger to create the teacher profile. After all three FK constraints point to `better_auth.users`, the same trusted server-only provisioner writes the teacher profile directly with the validated Better Auth UUID/name/school/phone and does not insert `auth.users`. It introspects the three fixed FK constraints and fails closed if they are missing, mixed, or point at an unexpected table, preventing a partially applied identity migration from creating ownership rows.

RLS semantics do not change in this phase. Authenticated PostgreSQL work still receives only the server-validated user UUID through `SET LOCAL ROLE authenticated` plus transaction-local `request.jwt.claim.sub`; `auth.uid()` and `public.current_teacher_id()` continue resolving that UUID. No browser/form/query parameter can choose an identity, role, backend, or FK anchor.

This remains a staging/disposable rehearsal. The manual cutover SQL must not be run against production until the controlled export/delta-import window, client-owned SMTP/HTTPS configuration, rollback plan, and acceptance tests are ready. Active Supabase sessions still do not migrate and users will reauthenticate after the eventual Better Auth traffic switch.

### Auth Phase 8 — Better Auth HTTP handler and traffic-cutover acceptance

Auth Phase 8 adds the final **staging traffic-switch acceptance boundary** without changing the default authority or touching production. The standard Better Auth HTTP surface is mounted at `/api/auth/[...all]` for `GET` and `POST`, but the route returns `404` while `AUTH_BACKEND` is missing or `supabase`. Better Auth configuration, secrets, and the PostgreSQL auth pool therefore remain inert on the rollback/default path. When Better Auth is explicitly selected, the route forwards the standard `Request` to the reviewed Better Auth handler so browser/client endpoints such as email sign-in, get-session, and sign-out use the same database-backed auth instance already exercised by server actions and Proxy.

Traffic cutover now has an explicit read-only readiness check. Environment validation requires `AUTH_BACKEND=better-auth`, `DATABASE_BACKEND=postgres`, a server-only `DATABASE_URL`, a 32+ character Better Auth secret, a valid Better Auth base URL, HTTPS in production, matching `PUBLIC_APP_URL`/`BETTER_AUTH_URL` origins, and working generic SMTP configuration for password recovery. Recovery is treated as part of the cutover boundary rather than a post-cutover repair so users are not stranded after active Supabase sessions are intentionally abandoned.

Database readiness verifies zero historical UUID gaps, zero reverse UUID gaps, zero normalized-email mismatches, complete Better Auth coverage for teacher/admin/uploader identities, exactly the three validated application FKs anchored to `better_auth.users` with their reviewed delete actions, retirement of the historical signup trigger, retirement of the temporary `service_role` read/insert bridge to `auth.users`, and continued `authenticated` access only to the `auth.uid()` compatibility surface needed by existing RLS. The operator command prints counts/booleans only and does not print emails, hashes, secrets, connection strings, or other user data.

The disposable post-cutover integration acceptance exercises the actual Better Auth HTTP handler: create a synthetic credential user, provision its teacher profile through the post-cutover application-identity path, sign in through `/api/auth/sign-in/email`, consume the returned database-backed session cookie through `/api/auth/get-session`, resolve the teacher role through the PostgreSQL identity repository/RLS boundary, sign out through `/api/auth/sign-out`, and confirm the same opaque session no longer resolves. This proves the traffic shape that will be used after the eventual environment flip rather than only testing internal auth APIs.

Phase 8 still does **not** perform a production export/import, production FK cutover, DNS/deployment change, or production `AUTH_BACKEND` flip. The Supabase auth adapter and default remain available during the acceptance/rollback window. A real cutover should only proceed after a client-owned HTTPS origin and SMTP account are configured, the final production Auth export/delta import is reviewed, Phase 7 manual FK cutover reports clean, this Phase 8 readiness/handler acceptance passes in staging, and users are told that existing Supabase sessions will require re-login.

### Auth Phase 9 — rollback-safe traffic-switch freeze

Auth Phase 9 closes the final configuration-only rollback gap before a real Better Auth traffic switch. After the Phase 7 FK cutover, a **new Better Auth signup** would exist only in `better_auth.users`, and a Better Auth password reset would change credentials only in Better Auth. Either mutation would make an immediate rollback to Supabase Auth incomplete. Phase 9 therefore introduces `AUTH_MUTATION_MODE=normal|cutover-freeze`, defaulting to `normal` for ordinary development and operation.

The production cutover sequence must set `AUTH_MUTATION_MODE=cutover-freeze` **before** the final privileged Supabase Auth delta export. The freeze stays enabled through final import/readiness review, manual FK cutover, Better Auth traffic switch, and the rollback acceptance window. Existing users may still sign in, sign out, resolve sessions, and use the application normally. Signup, password-recovery requests, password-reset completion, and every other direct Better Auth HTTP endpoint outside the explicit session allowlist are blocked with a temporary-unavailable response. This keeps `auth.users` and `better_auth.users` identity coverage stable while rollback remains configuration-first.

The freeze is enforced twice. The configured application auth boundary rejects signup/recovery/reset before dispatching to either Supabase or Better Auth. The `/api/auth/[...all]` HTTP gate independently allows only `GET /api/auth/get-session`, `POST /api/auth/sign-in/email`, and `POST /api/auth/sign-out` while frozen. Direct calls to Better Auth signup, password reset, change-password/change-email/delete-user, or other handler endpoints therefore cannot bypass the application actions. Blocked HTTP mutations do not initialize Better Auth and return `503` plus `Retry-After`.

`AUTH_BACKEND=supabase` remains the rollback selector during this **frozen acceptance window**. When Supabase is selected the Better Auth HTTP handler returns `404` before initialization, while the same mutation freeze prevents new Supabase-side identity/password drift until the operator either completes rollback or accepts Better Auth. The Phase 9 read-only operator check requires both `AUTH_MUTATION_MODE=cutover-freeze` and all Phase 8 traffic-readiness invariants; it prints only counts/booleans and does not expose user records, hashes, secrets, SMTP credentials, or database URLs.

After Better Auth has passed the acceptance window and the decision is made **not** to use configuration-only Supabase rollback anymore, set `AUTH_MUTATION_MODE=normal` to reopen signup and password recovery/reset on Better Auth. From that point onward, rollback requires a separately planned identity/credential reconciliation rather than merely changing `AUTH_BACKEND`; do not describe it as configuration-only rollback. Existing Supabase sessions are still not migrated and users must reauthenticate after the Better Auth traffic switch.


### Auth Phase 10 — final acceptance state and legacy-auth retirement gate

Auth Phase 10 makes the authentication migration lifecycle explicit without pretending that a production acceptance decision has already happened. `AUTH_CUTOVER_STATE` accepts `compatibility|rollback-window|accepted` and defaults to `compatibility`. The rollback-window state requires `DATABASE_BACKEND=postgres` and `AUTH_MUTATION_MODE=cutover-freeze`; during that window `AUTH_BACKEND` may be the reviewed Better Auth authority or the Supabase rollback selector. The accepted state is valid only with Better Auth + PostgreSQL and `AUTH_MUTATION_MODE=normal`. Merging this code does not change production because the default remains compatibility/Supabase until an operator deliberately changes the environment.

`accepted` is the one-way operational boundary for Auth. After it is set, the retained Supabase Auth adapter, Supabase proxy refresh path, and PKCE callback are defense-in-depth guarded and may not be used. The old `/auth/callback` responds as retired instead of exchanging a Supabase code. Changing `AUTH_BACKEND` back to Supabase while `AUTH_CUTOVER_STATE=accepted` is a configuration error, because post-acceptance signups and credential changes are intentionally no longer mirrored to the historical Supabase snapshot. A later repository-wide Supabase cleanup may physically delete the legacy adapter after all non-Auth Supabase fallbacks are retired.

The mounted Better Auth HTTP route is also narrowed permanently. This application owns signup and credential-mutation semantics in Server Actions because signup must provision a teacher profile and recovery/reset must obey application policy. The generic `/api/auth/*` route therefore exposes only email sign-in, database-backed get-session, and sign-out. Direct HTTP signup, recovery/reset, change-password/change-email/delete-user, or any other unreviewed Better Auth endpoint is blocked before the Better Auth handler initializes. During `cutover-freeze` those blocked mutations return temporary-unavailable (`503` + `Retry-After`); outside the freeze they remain hidden with `404`.

Accepted application provisioning requires all three reviewed application identity FKs to target `better_auth.users`; the pre-cutover `auth.users` mirror path is rejected in accepted mode. New accepted-state users therefore receive their teacher profile directly from the validated Better Auth UUID and do not create a historical `auth.users` mirror. The historical compatibility table may remain temporarily as an offline audit/rollback snapshot, but it is no longer an application identity authority.

Final acceptance readiness differs deliberately from rollback-window readiness. Before acceptance, bidirectional UUID parity is required so configuration-only rollback is complete. After acceptance, new Better Auth users are allowed to have no historical `auth.users` mirror. The final read-only check still requires every historical Supabase UUID to exist in Better Auth, normalized-email parity for overlapping rows, complete Better Auth coverage of teacher/admin/uploader identities, exactly the three validated FKs targeting `better_auth.users`, retired historical signup trigger/service-role bridge permissions, and continued authenticated `auth.uid()` RLS compatibility. No emails, hashes, secrets, SMTP credentials, or database URLs are printed.

Production acceptance sequence: keep `AUTH_CUTOVER_STATE=rollback-window` with mutations frozen through the final delta import, FK cutover, traffic switch, and rollback observation window; run the rollback-window and traffic checks; decide whether to accept Better Auth; then set `AUTH_CUTOVER_STATE=accepted` and `AUTH_MUTATION_MODE=normal` together and run the finalization check. Existing Supabase sessions are still not migrated, so users reauthenticate. Once accepted traffic creates new identities or changes credentials, returning to Supabase requires a separate reconciliation/migration plan and must not be described as an environment-only rollback.
