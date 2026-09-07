# A trading account lives on one Broker, chosen at buy

A Firm can offer more than one trading platform. We considered binding Broker on the Product (two product ids) or skipping provision until a real MT5 adapter existed.

The trader picks a Broker at buy. The id is stored on the Payment, then copied onto the TradingAccount at complete. It does not change. Complete calls Bridge `provision` before insert; failure leaves the Payment pending. Login and password live on the account row (plaintext this cut). Ingest keys are per Broker. Firm config stays a file.

Rejected: product-only bind, provision later, one ingest key, Firm config in the database this cut.

Firm config in the database is now ADR 0006.
