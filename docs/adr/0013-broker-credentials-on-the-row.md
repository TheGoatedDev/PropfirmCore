# Broker credentials live on the broker row

Ingest keys and bridge keys used to come from env names built off the broker id. Broker ids are now server-made, so an Admin could not set a key for a new Broker without a redeploy, and the global fallback key quietly covered every Broker.

Both keys live on the broker row. The ingest key is server-made, shown once on rotate, and stored as a SHA-256 hash: we only compare it. The bridge key is set by an Admin and stored plaintext: we must send it, same as broker login and password today. Neither is part of Firm config; `GET` and `PUT /firm` never carry them. Their own endpoints and permission (`broker:credentials`) set, rotate, and revoke them. Seed JSON may carry keys for dev and tests. Env keys are gone; existing deployments rotate once after upgrade.

Rejected: keep env as fallback, keys in the `PUT /firm` body, admin-typed ingest keys, encrypting the bridge key with an env master key this cut, rotation grace period. Supersedes ADR 0005 "Ingest keys are per Broker" as to where keys come from.
