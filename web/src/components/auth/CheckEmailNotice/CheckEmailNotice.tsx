import { InlineError } from '@/components/InlineError/InlineError';
import { LiveRegion } from '@/components/LiveRegion/LiveRegion';
import { LoadingButton } from '@/components/LoadingButton/LoadingButton';
import { OtpInput } from '@/components/OtpInput/OtpInput';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useLiveRegion } from '@/hooks/useLiveRegion';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import * as Sentry from '@sentry/react';
import { isAuthApiError } from '@supabase/supabase-js';
import { Check } from 'lucide-react';
import { useState } from 'react';

interface Props {
  email: string;
  onVerified: () => void;
  onResend?: () => Promise<void>;
  onChangeEmail?: () => void;
}

const OTP_LENGTH = 6;

type Status = 'idle' | 'verifying' | 'success';
type ResendStatus = 'idle' | 'sending';

export function CheckEmailNotice({ email, onVerified, onResend }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [resendStatus, setResendStatus] = useState<ResendStatus>('idle');
  const [resendError, setResendError] = useState<string | null>(null);
  const { message, announce } = useLiveRegion();

  const verify = async (token: string) => {
    setStatus('verifying');
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      });
      if (verifyError) throw verifyError;
      setError(null);
      setStatus('success');
      onVerified();
    } catch (err) {
      if (isAuthApiError(err)) {
        setError("That code didn't match. Check your email for the latest one.");
      } else {
        Sentry.captureException(err, {
          tags: { component: 'CheckEmailNotice', operation: 'verifyOtp' },
        });
        setError("Couldn't verify the code. Please try again.");
      }
      setStatus('idle');
    }
  };

  const handleComplete = (value: string) => {
    if (status === 'idle') verify(value);
  };

  const handleResend = async () => {
    if (!onResend || resendStatus === 'sending') return;
    setResendStatus('sending');
    setResendError(null);
    try {
      await onResend();
      announce('New confirmation email sent.');
    } catch (err) {
      const isRateLimit = isAuthApiError(err) && err.code === 'over_email_send_rate_limit';
      if (isRateLimit) {
        setResendError("You've sent too many confirmation requests. Please try again later.");
      } else {
        Sentry.captureException(err, {
          tags: { component: 'CheckEmailNotice', operation: 'resendConfirmation' },
        });
        setResendError("Couldn't send the email. Please try again.");
      }
    } finally {
      setResendStatus('idle');
    }
  };

  return (
    <Card
      className={cn(
        'w-full max-w-lg transition-all',
        !!error && 'animate-[shake_0.42s_cubic-bezier(0.36,0.07,0.19,0.97)]',
        status === 'success' && 'shadow-lg ring-1 shadow-emerald-500/10 ring-emerald-500/40',
      )}
    >
      <CardHeader>
        <div
          className={cn(
            'bg-secondary text-muted-foreground relative mb-4 flex size-12 items-center justify-center rounded-xl border transition-all',
            status === 'success' && 'border-emerald-500/40 text-emerald-500',
          )}
        >
          <EnvelopeMark className={cn('size-7', status === 'success' && 'text-emerald-500')} />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Check your email</h2>
        <div className="text-muted-foreground space-y-2 text-[14.5px] leading-[1.55]">
          <p>
            We sent a 6-digit code to{' '}
            <span className="text-foreground bg-secondary rounded-sm border px-1.5 py-0.5 font-mono text-xs">
              {email}
            </span>
            .
          </p>
          <p>Enter it below or click the link in the email to sign in to F1 Fantasy.</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="confirmation-code"
            className="text-muted-foreground text-[13px] font-medium tracking-[0.01em]"
          >
            Confirmation code
          </Label>
          <div className="bg-border h-0.75 w-20 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-all duration-200"
              style={{ width: `${(code.length / OTP_LENGTH) * 100}%` }}
            />
          </div>
        </div>

        <div className="mx-auto flex w-fit flex-col items-stretch gap-3">
          <OtpInput
            id="confirmation-code"
            length={OTP_LENGTH}
            value={code}
            onChange={setCode}
            onComplete={handleComplete}
            disabled={status === 'verifying' || status === 'success'}
          />

          {error && (
            <div className="w-0 min-w-full">
              <InlineError message={error} />
            </div>
          )}

          <LoadingButton
            type="button"
            onClick={() => {
              if (status === 'idle') verify(code);
            }}
            size="lg"
            className="w-full"
            isLoading={status === 'verifying'}
            loadingText="Verifying..."
            disabled={code.length < OTP_LENGTH || status === 'success'}
          >
            {status === 'success' ? (
              <>
                <Check />
                Verified
              </>
            ) : (
              'Verify'
            )}
          </LoadingButton>
        </div>
      </CardContent>

      {onResend && (
        <CardFooter className="flex-col items-center gap-3">
          <LiveRegion message={message} />
          {resendError && <InlineError message={resendError} />}
          <p className="text-muted-foreground text-sm">
            Didn't get your email?{' '}
            <LoadingButton
              type="button"
              onClick={handleResend}
              variant="link"
              className="h-auto p-0 align-baseline text-sm"
              isLoading={resendStatus === 'sending'}
              loadingText="Sending..."
              disabled={status === 'success'}
            >
              Resend the code
            </LoadingButton>
          </p>
        </CardFooter>
      )}
    </Card>
  );
}

function EnvelopeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <rect
        x="3.5"
        y="7.5"
        width="25"
        height="17"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4.5 9.5L16 17.5L27.5 9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25" cy="9" r="4.5" className="fill-primary stroke-card" strokeWidth="1.5" />
    </svg>
  );
}
