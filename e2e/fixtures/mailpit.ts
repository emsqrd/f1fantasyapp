// e2e Mailpit instance: dev's 54324 + 100 per the e2e port-shift convention.
// Supabase CLI now ships Mailpit even though its config section is [inbucket].
const MAILPIT_BASE_URL = 'http://127.0.0.1:54424';

export interface MailpitMessageSummary {
  ID: string;
}

export interface MailpitSearchResult {
  count: number;
  messages: MailpitMessageSummary[];
}

export interface MailpitMessage {
  ID: string;
  Text: string;
  HTML: string;
}

export async function searchByRecipient(
  email: string,
  opts?: { subject?: string },
): Promise<MailpitSearchResult> {
  const query = opts?.subject ? `to:${email} subject:"${opts.subject}"` : `to:${email}`;
  const url = `${MAILPIT_BASE_URL}/api/v1/search?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mailpit search failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as MailpitSearchResult;
}

export async function getMessage(id: string): Promise<MailpitMessage> {
  const res = await fetch(`${MAILPIT_BASE_URL}/api/v1/message/${id}`);
  if (!res.ok) {
    throw new Error(`Mailpit get message failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as MailpitMessage;
}

export async function getConfirmationUrl(email: string): Promise<string> {
  const search = await searchByRecipient(email);
  const message = await getMessage(search.messages[0].ID);
  const match = message.Text.match(/https?:\/\/\S*\/auth\/confirm\S*/);
  if (!match) throw new Error(`No confirmation URL in email to ${email}`);
  return match[0];
}

export async function getRecoveryUrl(email: string): Promise<string> {
  const search = await searchByRecipient(email);
  const message = await getMessage(search.messages[0].ID);
  const match = message.Text.match(/https?:\/\/\S*\/reset-password\S*/);
  if (!match) throw new Error(`No recovery URL in email to ${email}`);
  return match[0];
}

export async function getOtpCode(email: string): Promise<string> {
  const search = await searchByRecipient(email);
  const message = await getMessage(search.messages[0].ID);
  const match = message.Text.match(/\b(\d{6})\b/);
  if (!match) throw new Error(`No OTP code in email to ${email}`);
  return match[1];
}

export async function clearAll(): Promise<void> {
  const res = await fetch(`${MAILPIT_BASE_URL}/api/v1/messages`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Mailpit clear failed (${res.status}): ${await res.text()}`);
  }
}
