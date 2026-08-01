# 010. Isolated, non-persisting auth client for password recovery

- Status: Accepted
- Date: 2026-07-15
- Confidence: Medium

## Context and Problem Statement

A user who forgets their password lands on `/reset-password` from an emailed link and sets a new password; the app redeems the recovery token by calling `verifyOtp` on submit, then calls `updateUser` to change the password. GoTrue and supabase-js treat that redemption as authentication: `verifyOtp` creates a session and writes it to `localStorage` before the password is changed, and it can persist even when the subsequent `updateUser` is rejected (GoTrue refuses a password that is too weak or identical to the old one). Our product rule is that a recovery link proves the user can read their email, not that they are signed in — a user is authenticated only once the password is actually changed. All of the app's authentication currently runs through supabase-js in the browser; the .NET API validates tokens but is not in the auth path. How do we keep the app from ever observing or restoring a session for a password that never changed?

## Decision Drivers

- **No session for an unchanged password may reach the app** — not in memory, and not in the persisted storage the app reads on load.
- **The guarantee must survive a reload or a new tab**, not merely hold for the current component mount. A verified-but-not-changed session left on disk is an account-takeover vector for anyone who reads the reset email.
- **Safe when `updateUser` fails after the token is spent** — the weak-password and same-password rejections leave a live window that must expose nothing usable.
- **Depend on supported, verifiable behavior** rather than on the undocumented internal ordering of supabase-js.
- **Minimal disturbance to the shared client's normal sign-in and sign-out event handling.**
- **Keep the change within the existing client-side auth architecture.** Authentication runs entirely through supabase-js in the browser; this decision should not be the first to move auth responsibilities into the .NET API.

## Considered Options

- **Isolate the recovery exchange on a dedicated Supabase client** configured to never persist its session, and copy the confirmed session onto the main client only after `updateUser` succeeds.
- **Suppress `PASSWORD_RECOVERY` on the shared client** and acknowledge the user only on the later `USER_UPDATED` event.
- **Suppress the event and additionally clear the persisted session from storage** on every non-success path.
- **Redeem the recovery token server-side** in the .NET API, so the browser never receives a recovery session at all.

## Decision Outcome

We will run the recovery token exchange — both `verifyOtp` and `updateUser` — on a dedicated Supabase client configured with `persistSession: false`, and hand the resulting session to the main client only after the password change succeeds, because this is the only one of these client-side options that keeps the premature session out of the storage the app restores on load. Isolating the exchange makes the invariant a property of *where the session can live* rather than of *which events we react to*: a session that is never written to shared storage cannot be resurrected by a reload, a second tab, or an event the app happened to miss. Server-side redemption would solve it more decisively still — no browser session would exist to leak — but it would put the API into the auth path for the first time; the last driver rules it out for this flow, and it is the natural thing to reconsider if that constraint lifts. The failing alternative was implemented on this branch and discarded once a code review (finding #2 in `docs/plans/339-password-reset-link-path.md`) traced the reload-restores-a-signed-in-session hole to supabase-js persisting the session inside `verifyOtp` before it emits `PASSWORD_RECOVERY` — the event the suppression approach depends on.

### Consequences

- Good: The app never persists or reads a session for an unchanged password, so no reload, new tab, or dropped event can sign the user in prematurely. The shared client's auth handler drops its recovery special-case and simply applies whatever session it is given.
- Good: A rejected `updateUser` leaves nothing usable — the premature session existed only on the throwaway client and is discarded with it.
- Bad: The app now runs two Supabase auth clients. That is an unusual shape a future reader may take for redundancy and try to consolidate; doing so silently reopens the vulnerability. This record exists largely to prevent that.
- Bad: Because supabase-js derives an origin-wide Web Lock name from the client's storage key, the recovery client must use its own key or the two clients deadlock on each other's auth calls — a coupling that is invisible until something hangs.
- Bad: The session handoff (read the session off the recovery client, set it on the main client, then locally sign the recovery client out without revoking the token server-side) is bespoke wiring that must stay in step with supabase-js session semantics.
- Neutral: Enforcement is entirely client-side. Someone holding the emailed link still performs a real GoTrue token redemption; what changes is that no app session results until the password is set.

## Pros and Cons of the Options

### Isolate the recovery exchange on a dedicated non-persisting client

- Good, because `persistSession: false` is a documented client option, so the guarantee rests on supported configuration rather than on the internal ordering of persistence versus event emission.
- Good, because the premature session physically never reaches the storage the app reads, so no reload, new tab, or missed event can resurrect it.
- Bad, because it introduces a second auth client and the Web Lock coupling described above, adding a non-obvious failure mode and a shape that invites well-meaning consolidation.
- Neutral, because the recovery client still performs a full GoTrue token redemption; the isolation governs where the resulting session lives, not the strength of verification.

### Suppress `PASSWORD_RECOVERY` on the shared client

- Good, because it changes only the shared client's event handler and adds no new infrastructure.
- Bad, because `verifyOtp` writes the session to `localStorage` before it emits `PASSWORD_RECOVERY`, so the session is already on disk when the handler runs; suppressing the in-memory reaction does nothing about the stored copy, which the next load restores as an ordinary sign-in. This was confirmed against supabase-js source and by code review before the approach was dropped.
- Bad, because it leans on the undocumented ordering of persist-versus-emit, which a library upgrade could change without warning.

### Suppress the event and clear the persisted session on failure

- Good, because it keeps a single client while attempting to close the persisted-session hole.
- Bad, because it must catch every exit path — `updateUser` rejection, component unmount, navigation away, tab close — and the tab-close path cannot run reliably, leaving exactly the window (verify succeeds, user abandons the tab) that the vulnerability exploits.
- Bad, because it is a race-prone patch layered over the same fragile ordering rather than a structural guarantee.

### Redeem the recovery token server-side

- Good, because no recovery session ever reaches the browser, so the whole class of "premature session left in storage" problems disappears at its source instead of being contained after the fact.
- Good, because it needs neither a second client nor the Web Lock coupling the chosen option introduces.
- Bad, because it puts the .NET API into the authentication path for the first time — today the API only validates tokens — which is a larger structural change than this reset flow warrants and one this record deliberately declines to make.
- Bad, because the API would have to drive GoTrue's recovery redemption itself and return a session to the SPA, duplicating auth wiring that currently lives entirely in supabase-js.

## Revisit if

supabase-js gains a first-class way to redeem a recovery token without creating a persisted session (a verify-only or explicitly ephemeral-session option), or changes the persist-before-emit ordering such that suppression on the shared client becomes sufficient — either would let the second client be removed. Also reconsider if the .NET API otherwise takes on authentication responsibilities, which would remove the driver that rules server-side redemption out.

## More Information

- `docs/plans/339-password-reset-link-path.md` — the feature plan and the code review (finding #2) that identified the reload-restores-session hole.
- Commit `29a20e7` — the implementation this record describes.
