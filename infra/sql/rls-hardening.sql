-- Run once in the Supabase SQL Editor for the EduFX project.
-- The backend uses the service role; browser requests must not query these
-- tables directly. This is intentionally deny-by-default for API roles.

begin;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'students',
    'subtopics',
    'content',
    'questions',
    'student_progress',
    'session_summary',
    'behaviour_logs',
    'quiz_attempts',
    'content_chunks'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('drop policy if exists "Deny direct API access" on public.%I', table_name);
    execute format(
      'create policy "Deny direct API access" on public.%I for all to anon, authenticated using (false) with check (false)',
      table_name
    );
  end loop;
end
$$;

revoke execute on function public.match_content_chunks(vector, bigint, integer) from anon, authenticated;
grant execute on function public.match_content_chunks(vector, bigint, integer) to service_role;

commit;
