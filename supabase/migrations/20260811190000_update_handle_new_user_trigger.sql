-- ============================================================================
-- Checkpoint 4: extend handle_new_user to also persist school and phone
-- from signup metadata. NOT YET APPLIED — for review.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.teachers (user_id, name, school, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.raw_user_meta_data ->> 'school',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;
