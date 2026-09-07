# Firm config lives in Postgres

A stack can host many Firms. Config is normalized tables keyed by Firm slug, not a JSON file and not a jsonb blob. JSON files seed only when the table is empty. This cut serves exactly one live row: boot throws if the count is not 1. Admin PUT replaces that row; api and worker reload via LISTEN/NOTIFY.

Rejected: jsonb document, overwrite from file every boot, POST /firms or Host routing this cut. Supersedes ADR 0005 “Firm config stays a file”.
