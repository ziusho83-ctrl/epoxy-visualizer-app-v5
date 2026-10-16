# Estimate delivery

Production implementation sends directly through Resend to sales@luxshieldcoatings.com
from estimates@luxshieldcoatings.com. RESEND_API_KEY is server-only.

Includes customer contact, ZIP/address, area, selected base/flake/size/sheen, notes
and JPEG floor visualization. Customer email becomes Reply-To on the sales notification; customer confirmations are described below.

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

## Customer design email (October 16)
- Save/Share downloads remain ungated. Its Email me this design form requires only
  email, calls /api/email-design and sends no sales notification or estimate lead.
- Finished-floor JPEG plus labeled side-by-side before/after JPEG attached; includes
  finish and request-estimate/reply guidance. No photo hosting or resumable-design
  link: the visualizer link requires re-upload; replying to sales is also offered.
- Estimate requests send sales first, then a customer confirmation when email is
  supplied, including optional email with phone contact. Confirmation failure does
  not invalidate a submitted estimate; explicit retry reuses the original payload
  and owner/customer idempotency keys. No auto-retry worker or marketing enrollment.
- Existing browser payloads without a comparison image still submit and receive a
  finished-floor attachment only. New client sends both images.
- Design-only endpoint uses fixed templates, email/finish/image validation and a
  best-effort per-instance recipient burst guard; not a distributed abuse quota.
