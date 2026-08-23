-- Phase 7: private authorized textbook ingestion and scoped vector retrieval.
-- Forward-only: existing textbook IDs and historical exams are preserved.

create extension if not exists vector with schema extensions;

create type public.textbook_processing_status as enum ('uploaded', 'processing', 'ready', 'failed');
create type public.textbook_source_type as enum ('school_supplied', 'publisher_authorized', 'oer', 'other_authorized');

create table public.textbook_documents (
  id uuid primary key default gen_random_uuid(),
  textbook_id uuid not null references public.textbooks(id) on delete restrict,
  storage_path text not null unique check (storage_path ~ '^textbooks/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+\.pdf$'),
  original_filename text not null,
  mime_type text not null check (mime_type = 'application/pdf'),
  file_size bigint not null check (file_size > 0 and file_size <= 12582912),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  processing_status public.textbook_processing_status not null default 'uploaded',
  processing_error text,
  page_count integer check (page_count is null or page_count > 0),
  extracted_character_count integer check (extracted_character_count is null or extracted_character_count >= 0),
  chunk_count integer check (chunk_count is null or chunk_count >= 0),
  embedding_model text,
  embedding_dimension integer,
  source_type public.textbook_source_type not null,
  authorization_note text,
  authorization_acknowledged boolean not null check (authorization_acknowledged),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (textbook_id, content_sha256)
);

create table public.textbook_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.textbook_documents(id) on delete cascade,
  textbook_id uuid not null references public.textbooks(id) on delete restrict,
  chunk_index integer not null check (chunk_index >= 0),
  page_start integer not null check (page_start > 0),
  page_end integer not null check (page_end >= page_start),
  text text not null check (char_length(text) between 40 and 3000),
  character_count integer not null check (character_count = char_length(text)),
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(2048) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index textbook_documents_textbook_status_idx on public.textbook_documents(textbook_id, processing_status);
create index textbook_documents_uploaded_by_idx on public.textbook_documents(uploaded_by);
create index textbook_chunks_document_idx on public.textbook_chunks(document_id, chunk_index);
create index textbook_chunks_textbook_idx on public.textbook_chunks(textbook_id);

alter table public.textbook_documents enable row level security;
alter table public.textbook_chunks enable row level security;

create policy textbook_documents_admin_all on public.textbook_documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy textbook_chunks_admin_select on public.textbook_chunks for select to authenticated
  using (public.is_admin());

revoke all on public.textbook_documents, public.textbook_chunks from anon, authenticated;
grant select, insert, update, delete on public.textbook_documents to service_role;
grant select, insert, update, delete on public.textbook_chunks to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('textbooks', 'textbooks', false, 12582912, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policy is intentionally created. Only the service role can access files.

create or replace function public.list_ready_textbooks(p_subject_id uuid, p_grade_id uuid)
returns table (id uuid, name text, publisher text)
language sql security definer stable set search_path = public
as $$
  select distinct t.id, t.name, t.publisher
  from public.textbooks t
  join public.textbook_documents d on d.textbook_id = t.id
  where auth.role() = 'authenticated'
    and t.subject_id = p_subject_id and t.grade_id = p_grade_id
    and d.processing_status = 'ready'
  order by t.name;
$$;

revoke all on function public.list_ready_textbooks(uuid, uuid) from public, anon;
grant execute on function public.list_ready_textbooks(uuid, uuid) to authenticated;

create or replace function public.match_textbook_chunks(
  p_textbook_id uuid,
  p_query_embedding extensions.vector(2048),
  p_limit integer default 8,
  p_document_id uuid default null
)
returns table (chunk_id uuid, document_id uuid, textbook_id uuid, page_start integer, page_end integer, text text, relevance_score double precision)
language sql security definer stable set search_path = public, extensions
as $$
  select c.id, c.document_id, c.textbook_id, c.page_start, c.page_end, c.text,
    1 - (c.embedding <=> p_query_embedding) as relevance_score
  from public.textbook_chunks c
  join public.textbook_documents d on d.id = c.document_id
  where auth.role() = 'service_role'
    and c.textbook_id = p_textbook_id
    and d.textbook_id = p_textbook_id
    and d.processing_status = 'ready'
    and (p_document_id is null or d.id = p_document_id)
  order by c.embedding <=> p_query_embedding
  limit least(greatest(p_limit, 1), 12);
$$;

revoke all on function public.match_textbook_chunks(uuid, extensions.vector, integer, uuid) from public, anon, authenticated;
grant execute on function public.match_textbook_chunks(uuid, extensions.vector, integer, uuid) to service_role;
