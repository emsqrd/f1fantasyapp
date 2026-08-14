# 011. Length-only password policy (8 to 72 characters)

- Status: Accepted
- Date: 2026-08-12
- Confidence: High

## Context and Problem Statement

User accounts authenticate through Supabase Auth (GoTrue) with a password as the only factor. The project runs on Supabase's free tier, which applies per-IP rate limits to authentication endpoints; built-in leaked-password screening (via the HaveIBeenPwned API) is a Pro-plan feature. GoTrue hashes passwords with bcrypt and rejects any password longer than 72 characters, and it enforces password policy only when a password is set, never when an existing password is verified at sign-in. An account guards a fantasy F1 team and league memberships: no payment instruments, no personal data beyond an email address. The service previously ran on GoTrue's 6-character default minimum. What rules should a password have to satisfy when it is set?

## Decision Drivers

- Resistance to online guessing of user-chosen passwords at a single-factor sign-in.
- Low sign-up friction: the account guards entertainment data, and every additional rule risks abandonment at the first form a user sees.
- Rules must be backed by evidence that they improve the strength of passwords users actually choose, not by checklist convention.
- Rules must be enforceable at the verifier without adding infrastructure to the managed auth path, or the cost of that infrastructure must be justified by what the account protects.

## Considered Options

- Minimum 8 characters, no composition requirements, no breach screening
- Minimum 8 characters plus required lowercase, uppercase, digit, and symbol (the configuration Supabase suggests)
- Minimum 15 characters, no composition requirements (NIST SP 800-63B rev. 4's single-factor length requirement)
- Minimum 8 characters, no composition requirements, plus breached-password screening

## Decision Outcome

We will require passwords to be 8 to 72 characters long, with no character-class requirements and no breached-password screening, enforced when a password is set. Composition rules are out because NIST SP 800-63B rev. 4 states verifiers SHALL NOT impose them, and OWASP, NCSC, and Microsoft guidance concurs: users satisfy character classes with predictable substitutions rather than stronger passwords, so length is the only rule that earns its friction. The 8-character floor is the lowest minimum the cited standards themselves use — NIST's floor (SHALL) where a second factor is present, matched by OWASP's threshold — and it clears the minimum Supabase documents (below 8 "is not recommended"). NIST requires a 15-character minimum (SHALL) when the password is the only factor, and OWASP classifies shorter single-factor passwords as weak; we knowingly take the lower floor because demanding 15 characters to open a fantasy sports account is friction out of proportion to what the account protects.

We will launch without breached-password screening even though NIST makes it a requirement (SHALL) and OWASP recommends it, because on the current plan no option satisfies the requirement where it applies: at the verifier. Supabase's built-in screening is Pro-plan gated, and screening we add ourselves could run only in the browser, which a direct call to the auth API bypasses. Closing the gap properly means paying for the Pro plan or fronting managed auth with custom infrastructure, and neither cost is justified by what the account protects today.

The 72-character ceiling is bcrypt's input limit in GoTrue, surfaced to the user as a stated rule rather than an unexplained server rejection.

### Consequences

- Good: The whole policy fits one hint line ("Password must be at least 8 characters"), and the sign-up form has exactly one password rule to explain.
- Good: Two numbers define the entire policy, so the client validation, local Supabase configuration, and hosted project can state identical rules without interpretation.
- Bad: Passwords like "password1" and reused, already-breached passwords are valid. Supabase's per-IP token-bucket rate limits slow guessing from a single origin but do not defeat distributed guessing or credential stuffing, so until screening exists the length rule is the only password-quality control.
- Bad: We are out of conformance with the current revision of the primary standard we otherwise follow; an audit against NIST 800-63B rev. 4 flags both the 15-character minimum and the missing breach screening.
- Neutral: Because GoTrue applies policy only at set-time, passwords created under the 6-character default keep working at sign-in until their owners next change them.

## Pros and Cons of the Options

### Minimum 8 characters, no composition requirements, no breach screening

- Good, because it carries the least sign-up friction of the four options: one rule to read, one way to fail.
- Good, because it clears the floor Supabase documents and matches the minimum NIST and OWASP accept when a second factor is present.
- Bad, because no second factor is on offer here, so NIST's 15-character single-factor requirement goes unmet and OWASP classifies the floor as weak; resistance to online guessing leans on per-IP rate limiting.

### Minimum 8 characters plus all four character classes

- Good, because it is the configuration the Supabase dashboard suggests and the one Supabase's security documentation calls the strongest option, making it the vendor's own recommendation and the shape compliance checklists still commonly expect.
- Good, because it rejects single-class passwords such as "password" or "12345678" outright.
- Bad, because NIST SP 800-63B rev. 4 prohibits composition rules for verifiers, citing evidence that users meet them with predictable substitutions ("P@ssw0rd1!") that add little guessing resistance; OWASP, NCSC, and Microsoft agree.
- Bad, because it carries the most friction of the four options: four rules to communicate and four distinct ways for a chosen password to be rejected.

### Minimum 15 characters, no composition requirements

- Good, because it conforms to NIST SP 800-63B rev. 4's single-factor length requirement, and length is the one property with strong evidence of increasing the strength of user-chosen passwords.
- Good, because it shares the one-rule simplicity of the chosen option.
- Bad, because demanding 15 characters to open a fantasy sports account is friction out of proportion to what the account protects, particularly for users without a password manager.
- Bad, because it leaves NIST's separate breach-screening requirement unmet: a 15-character password can still be a reused, already-breached one, which only screening catches.

### Minimum 8 characters, no composition requirements, plus breached-password screening

- Good, because it closes the gap every other option shares: reused, breached passwords, the exposure both NIST (as a SHALL) and OWASP direct verifiers to screen for.
- Good, because HaveIBeenPwned offers a free k-anonymity API, so the screening data itself costs nothing.
- Bad, because on the current plan the verifier cannot perform the check: Supabase's built-in screening requires the Pro plan, and screening we build could run only in the browser, where a direct call to the auth API bypasses it. NIST's requirement applies to the verifier, and browser-only screening does not meet it.
- Bad, because meeting the requirement at the verifier means paying for the Pro plan or putting custom infrastructure in front of managed auth, costs out of proportion to what the account protects today.

## Revisit if

- The project moves to a Supabase plan that includes leaked-password protection: enable it, retiring the breach-screening deviation without changing this policy's numbers.
- Accounts start guarding more than fantasy data (payments, personal data beyond an email) or a second factor becomes available: re-evaluate the 8-character minimum against NIST's 15.

## More Information

- [Issue #345](https://github.com/emsqrd/f1fantasyapp/issues/345) — the work this policy applies to.
- [NIST SP 800-63B rev. 4](https://pages.nist.gov/800-63-4/sp800-63b.html) — normative password verifier requirements (§ Passwords).
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) — length thresholds, no-composition guidance, breach screening.
- [Supabase password security](https://supabase.com/docs/guides/auth/password-security) — configuration options and leaked-password protection plan gating.
- [Supabase auth rate limits](https://supabase.com/docs/guides/auth/rate-limits) — the per-IP limits the consequences lean on.
- [Supabase Auth (GoTrue) source](https://github.com/supabase/auth) — `internal/api/password.go` defines `MaxPasswordLength = 72`, the ceiling this policy surfaces.
