#!/usr/bin/env bash
# Recrée une base locale « lalla_test » avec l'émulation Supabase et toutes les migrations.
set -euo pipefail
DB=${DB:-lalla_test}
cd "$(dirname "$0")/../.."
su postgres -c "dropdb --if-exists $DB" >/dev/null
su postgres -c "createdb $DB"
run() { su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $DB -f $1" ; }
run supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
echo "Base $DB prête."
