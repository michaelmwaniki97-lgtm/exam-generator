# Self-Hosted Database Abstraction — RPC Foundation

Status: RPC foundation and CRUD Phases 1-10A are checkpointed; CRUD Phase 10B (payment entitlement read) is under review and uncommitted. Production behavior still defaults to Supabase. Authentication, storage, production data, Daraja, and deployment are unchanged.

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
