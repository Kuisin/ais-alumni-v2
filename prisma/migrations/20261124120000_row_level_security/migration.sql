-- Supabase serves every table in "public" through its Data API (PostgREST)
-- to anyone holding the project's publishable key — which the app hands to
-- members for realtime — unless Row-Level Security is on. Nothing reads the
-- database that way: the server uses Prisma as the tables' owner, which RLS
-- doesn't apply to. So: RLS on every table with no policies (the API's
-- anon / authenticated roles see nothing), and those roles lose their
-- grants, now and for tables later migrations create.
--
-- Prisma doesn't model RLS, so the schema is unchanged. On a plain Postgres
-- (CI) the Supabase roles don't exist and only RLS is turned on.

DO $$
DECLARE
  t record;
  unowned text;
BEGIN
  -- Stop (before any change) if the migrating role isn't exempt from RLS:
  -- the app connects as the same role and would see empty tables.
  IF NOT (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    SELECT string_agg(tablename, ', ') INTO unowned
      FROM pg_tables
     WHERE schemaname = 'public' AND tableowner <> current_user;
    IF unowned IS NOT NULL THEN
      RAISE EXCEPTION 'RLS would hide tables from %: not their owner (%)', current_user, unowned;
    END IF;
  END IF;

  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  END IF;
END $$;
