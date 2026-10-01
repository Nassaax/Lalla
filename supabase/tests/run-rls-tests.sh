#!/usr/bin/env bash
# Lance les tests RLS sur une base locale fraîche.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=lalla_rls supabase/tests/reset-local.sh >/dev/null 2>&1
su postgres -c "psql -v ON_ERROR_STOP=1 -q -t -A -d lalla_rls -f supabase/tests/rls.test.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
