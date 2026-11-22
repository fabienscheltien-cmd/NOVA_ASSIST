#!/usr/bin/env bash
# Applique la migration sur une base PostgreSQL locale jetable et vérifie les règles d'accès.
set -euo pipefail
cd "$(dirname "$0")/../.."
dropdb --if-exists nova_assist_test && createdb nova_assist_test
cat tests/sql/stub-supabase.sql docs/supabase/nova_assist_schema.sql tests/sql/test-rls.sql \
  | psql -v ON_ERROR_STOP=1 -q -d nova_assist_test 2>&1 | grep -E "ok :|ÉCHEC|ERROR"
