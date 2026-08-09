# Password-changed notification email (#342)

## Context

When an account's password is changed, the owner gets no signal — a silent takeover leaves the victim nothing to act on. Supabase ships a native security notification for exactly this: a gotrue-level toggle that emails the account address after every password change. This plan enables it in both local stacks with a branded template, asserts it in the existing e2e reset happy path, and lists the manual production steps.

Part of #166; depends on #339 (closed). No app code changes — config, one template, three e2e-side edits, one CLAUDE.md line.

Supersedes the implementation notes on the issue: the rate limits go to 100 (not 50), for the reasons below.

## Design decisions

- **Native notification, global toggle, no suppression.** `[auth.email.notification.password_changed]` fires on every password update through any path — completing a recovery today, the future account-page change-password automatically when it exists. gotrue offers no per-flow suppression, and none is wanted: notifying on every change (including self-service resets the user just performed) is the OWASP-recommended posture.
- **Custom template, informational only.** The template gets only `{{ .Email }}` and `{{ .SiteURL }}` — no timestamp, IP, or device data — so the email can only say *that* the password changed, not when or from where. No CTA button, no links, no P.S. The body (verbatim, only `{{ .Email }}` used):

  > Success! You've just changed the password for your F1 Fantasy account ({{ .Email }}).
  >
  > If you didn't make this change, please contact support.

  "Contact support" is a placeholder — no contact page exists yet; the line gets revisited when one ships.
- **Subject: "Your F1 Fantasy password was changed"** — unlike the confirmation and reset emails, this one arrives unprompted, so the product name goes in the subject for inbox attribution.
- **Styling matches the existing templates as they stand at implementation time.** Clone the `confirmation.html`/`password-reset.html` structure as it is on `main` when this lands.
- **`email_sent = 100` in both stacks, and the key is currently inert.** On the current CLI, the config value only reaches gotrue when `[auth.email.smtp]` is enabled; without it the CLI injects `GOTRUE_RATE_LIMIT_EMAIL_SENT=360000` (verified in CLI source and against both running local containers). 100 matches Supabase's own local-testing configs on GitHub (`supabase/ui-library` `config.toml`, `supabase/auth` `example.env`) and is generous if a future CLI version enforces the key again. With both stacks equal, the `email_sent` exemption in `config-sync.spec.ts` guards a divergence that no longer exists — drop it so the key is sync-checked like any other. No new config comments: the scaffold comment already states the requires-SMTP constraint.
- **E2E asserts the notification by subject, not by count.** After a completed reset the user's mailbox holds two emails (recovery + notification); a bare count can't tell "notification landed" from "recovery double-sent." Mailpit's search syntax documents `subject:"..."` filtering, and the suite already drives the same `/api/v1/search` endpoint with `to:` filters. One assertion on the existing happy path — the e2e stack is the only automated layer running a real gotrue with this config, and "deployment/config" is e2e-owned per the testing strategy.
- **Production is dashboard-managed.** Per #164/#339, the hosted project reads email config and templates from the dashboard, not the repo. Prod delivery goes through Resend (custom SMTP) — recorded in CLAUDE.md as part of this commit.

## Commit — `feat(auth): enable password-changed notification email`

- **Add `api/supabase/templates/password-changed.html`** — clone the current template structure and palette (dark-mode blocks included). Heading "Your password was changed"; body copy verbatim from Design decisions; `{{ .Email }}` is the only variable; no links, button, code row, or P.S. (e2e sees the file via the `e2e/supabase/templates` symlink.)
- **Modify `api/supabase/config.toml` + `e2e/supabase/config.toml`** — identical block directly after `[auth.email.template.recovery]` in both (config-sync compares ordered lines):

  ```toml
  [auth.email.notification.password_changed]
  enabled = true
  subject = "Your F1 Fantasy password was changed"
  content_path = "./supabase/templates/password-changed.html"
  ```

  In the same edit, `email_sent = 2` → `100` (dev) and `email_sent = 30` → `100` (e2e); scaffold comment untouched.
- **Modify `e2e/tests/_infra/config-sync.spec.ts`** — remove `email_sent` from `IGNORED_KEY_RE` and delete its bullet from the exceptions comment.
- **Modify `e2e/fixtures/mailpit.ts`** — `searchByRecipient(email, opts?: { subject?: string })`; with a subject, the query becomes `to:${email} subject:"${opts.subject}"`.
- **Modify `e2e/tests/password-reset.spec.ts`** — in the first happy path, after the reset lands on `/` (after the welcome-heading assertion, before the sign-out section):

  ```ts
  await expect
    .poll(
      async () =>
        (await searchByRecipient(user.email, { subject: 'Your F1 Fantasy password was changed' }))
          .count,
      { timeout: 10_000 },
    )
    .toBe(1);
  ```

  The pre-link `.toBe(1)` poll stays (the notification cannot exist before the reset completes); the two-tabs test is untouched.
- **Modify `CLAUDE.md`** — Production Infrastructure table gains a row: Email delivery → Resend (Supabase custom SMTP).

**Tests:** the e2e assertion above is the test — no unit or backend-integration layer can see a gotrue config change. `config-sync.spec.ts` guards the config drift, now covering `email_sent` too.

**Verify:** restart both local stacks to pick up config (`npm run` supabase start/stop scripts). `npm run e2e` (requires the e2e stack), `npm run e2e:lint`, `npm run e2e:format:check`. Manual, dev stack: complete a password reset in the browser, then in Mailpit (54324) confirm the notification arrived alongside the recovery email — subject, body copy, email substitution, light/dark rendering.

## Production deployment (post-merge, manual)

1. In the hosted dashboard, enable the password-changed security notification; paste the subject ("Your F1 Fantasy password was changed") and the contents of `password-changed.html` — same routine as #339's reset template. If the dashboard has no password-changed notification section, stop here: hosted auth doesn't ship the feature yet, and nothing in the local setup depends on it.
2. Run one real password reset against production and confirm both emails arrive and render correctly.

## Out of scope

- Glossary entries (decided against for this issue).
- Custom email-sending infrastructure, capacity/volume checks.
- Any `web/` code; OTP path and resend remain sibling sub-issues of #166.
