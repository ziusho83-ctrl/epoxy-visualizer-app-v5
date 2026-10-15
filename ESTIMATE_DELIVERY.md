# Estimate delivery

Production implementation sends directly through Resend to sales@luxshieldcoatings.com
from estimates@luxshieldcoatings.com. RESEND_API_KEY is server-only.

Includes customer contact, ZIP/address, area, selected base/flake/size/sheen, notes
and JPEG floor visualization. Customer email becomes Reply-To; no autoreply.

Success means Resend accepted/queued the email, NOT confirmed inbox delivery.
Failures preserve the form. Retries reuse an Idempotency-Key while payload remains
unchanged; provider deduplication window is 24 hours. Rate limits or provider
failures return an error, not false success. No autonomous resend worker.

IMPORTANT: No independent durable lead database, CRM, or outbox has been provisioned.
The recipient mailbox is the operational lead record; Resend logs have provider
retention limits. Do not describe this as durable database-backed lead capture.
A separate database/outbox integration remains future work.

Tests: node --test checks/quote.test.mjs; npm run build; npm run lint;
CHROMIUM_PATH=<installed browser> npm test. Browser tests mock delivery.
Real candidate POST must be verified separately before promotion.
