#!/usr/bin/env bash
set -Eeuo pipefail

psql_base=(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --no-align --tuples-only --set ON_ERROR_STOP=1)

"${psql_base[@]}" <<'SQL'
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-4000-8000-000000000081', 'concurrency@example.test', '{"name":"Concurrency Teacher"}')
on conflict (id) do nothing;

update public.ai_operation_reservations
set status = 'failed', completed_at = now(), lease_expires_at = now()
where teacher_id = (select id from public.teachers where user_id = '00000000-0000-4000-8000-000000000081')
  and status = 'active';
SQL

teacher_id=$("${psql_base[@]}" --command "select id from public.teachers where user_id = '00000000-0000-4000-8000-000000000081'")
output_directory=$(mktemp -d)
trap 'rm -rf "$output_directory"' EXIT

"${psql_base[@]}" --command "select outcome from public.claim_ai_generation('$teacher_id', '00000000-0000-4000-8000-000000000082')" >"$output_directory/one" &
first_pid=$!
"${psql_base[@]}" --command "select outcome from public.claim_ai_generation('$teacher_id', '00000000-0000-4000-8000-000000000083')" >"$output_directory/two" &
second_pid=$!
wait "$first_pid"
wait "$second_pid"

acquired_count=$(grep -hxc 'acquired' "$output_directory/one" "$output_directory/two" | awk '{total += $1} END {print total + 0}')
blocked_count=$(grep -hExc 'busy|duplicate_active' "$output_directory/one" "$output_directory/two" | awk '{total += $1} END {print total + 0}')
if [[ "$acquired_count" -ne 1 || "$blocked_count" -ne 1 ]]; then
  echo "Concurrent generation invariant failed" >&2
  cat "$output_directory/one" "$output_directory/two" >&2
  exit 1
fi

echo "PASS concurrent AI generation: one acquired, one blocked"

"${psql_base[@]}" --command "update public.ai_operation_reservations set status = 'failed', completed_at = now(), lease_expires_at = now() where teacher_id = '$teacher_id' and status = 'active'"
exam_id=$("${psql_base[@]}" --command "select parity_test.make_exam('$teacher_id', 'Concurrent regeneration fixture')")

"${psql_base[@]}" --command "select outcome from public.claim_ai_regeneration('$teacher_id', '$exam_id', 'slot-one', '00000000-0000-4000-8000-000000000084', 1)" >"$output_directory/regen-one" &
first_pid=$!
"${psql_base[@]}" --command "select outcome from public.claim_ai_regeneration('$teacher_id', '$exam_id', 'slot-two', '00000000-0000-4000-8000-000000000085', 1)" >"$output_directory/regen-two" &
second_pid=$!
wait "$first_pid"
wait "$second_pid"

acquired_count=$(grep -hxc 'acquired' "$output_directory/regen-one" "$output_directory/regen-two" | awk '{total += $1} END {print total + 0}')
blocked_count=$(grep -hExc 'busy|duplicate_active' "$output_directory/regen-one" "$output_directory/regen-two" | awk '{total += $1} END {print total + 0}')
if [[ "$acquired_count" -ne 1 || "$blocked_count" -ne 1 ]]; then
  echo "Concurrent regeneration invariant failed" >&2
  cat "$output_directory/regen-one" "$output_directory/regen-two" >&2
  exit 1
fi

echo "PASS concurrent AI regeneration: one acquired, one blocked"
