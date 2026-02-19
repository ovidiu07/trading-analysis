DO $$
DECLARE
    schema_name text := current_schema();
    plans_table_exists boolean;
    source_udt text;
    scope_udt text;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables t
        WHERE t.table_schema = schema_name
          AND t.table_name = 'plans'
    )
    INTO plans_table_exists;

    IF NOT plans_table_exists THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'plansource'
          AND n.nspname = schema_name
    ) THEN
        EXECUTE format(
            'CREATE TYPE %I.plansource AS ENUM (''MENTOR'', ''USER'')',
            schema_name
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'planscope'
          AND n.nspname = schema_name
    ) THEN
        EXECUTE format(
            'CREATE TYPE %I.planscope AS ENUM (''DAILY'', ''WEEKLY'')',
            schema_name
        );
    END IF;

    SELECT c.udt_name
    INTO source_udt
    FROM information_schema.columns c
    WHERE c.table_schema = schema_name
      AND c.table_name = 'plans'
      AND c.column_name = 'source';

    IF source_udt IS NOT NULL AND source_udt <> 'plansource' THEN
        EXECUTE format(
            'ALTER TABLE %I.plans ' ||
            'ALTER COLUMN source TYPE %I.plansource ' ||
            'USING source::text::%I.plansource',
            schema_name,
            schema_name,
            schema_name
        );
    END IF;

    SELECT c.udt_name
    INTO scope_udt
    FROM information_schema.columns c
    WHERE c.table_schema = schema_name
      AND c.table_name = 'plans'
      AND c.column_name = 'scope';

    IF scope_udt IS NOT NULL AND scope_udt <> 'planscope' THEN
        EXECUTE format(
            'ALTER TABLE %I.plans ' ||
            'ALTER COLUMN scope TYPE %I.planscope ' ||
            'USING scope::text::%I.planscope',
            schema_name,
            schema_name,
            schema_name
        );
    END IF;
END
$$;
