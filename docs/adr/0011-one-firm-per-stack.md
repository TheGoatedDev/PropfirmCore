# One Firm per stack

A stack is one Firm. Users have no firm membership field. Operator configures that Firm; Admin runs day-to-day. Config and book rows still reference the Firm id. Custom roles later are a name catalog, not `(firm_id, name)`.

Rejected: many Firms one stack, Host routing, `user.firmId`, Better Auth organization plugin. Supersedes ADR 0007. Narrows ADR 0006: one live row is the product, not a temporary cut.
