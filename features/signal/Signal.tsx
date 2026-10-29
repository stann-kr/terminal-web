'use client';
import { Fragment, Suspense, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Action, ActionDeck, Bay, Panel, ui } from '@/features/ui/Ui';
import {
  Consent,
  Field,
  FormError,
  FormPanel,
  FormSuccess,
  formStyles,
  literalInput,
} from '@/features/ui/Form';
import { ApiError, errorMessage, postJson } from '@/features/ui/http';
import { instagram } from '@/features/about/instagram';
import { useSignalSubscription } from './useSignalSubscription';
import styles from './signal.module.css';

/**
 * The note on the channel and the form around one subscription request, so both read the same
 * state. `wrap` places each part (the stage puts each in its own column).
 */
export function SignalBody({ wrap = node => node }: { wrap?: (node: ReactNode) => ReactNode }) {
  const request = useSignalSubscription();
  return (
    <>
      {[
        <SignalInformation key="info" request={request} />,
        <SignalForm key="form" request={request} />,
      ].map(part => <Fragment key={part.key}>{wrap(part)}</Fragment>)}
    </>
  );
}
function SignalInformation({
  request,
}: {
  request: ReturnType<typeof useSignalSubscription>;
}) {
  const { pending, done, error } = request;
  return (
    <Panel title="수신 안내" label="Signal" code="CH 01" surface="mark">
      <p className={styles.lead}>TERMINAL의 새로운 이벤트와 소식을 안내합니다.</p>
      <p
        className={styles.signalMatrix}
        aria-hidden="true"
        data-state={
          pending ? 'sending' : done ? 'saved' : error ? 'error' : 'idle'
        }
      >
        <i />
        {pending
          ? 'TRANSMITTING'
          : done
            ? 'CHANNEL REGISTERED'
            : error
              ? 'TRANSMISSION FAILED'
              : 'CHANNEL STANDBY'}
      </p>
      <Bay label="CHANNEL 01 / STANDBY" />
      <ActionDeck className={styles.deck}>
        <Action href="/about">소개 / 공식 채널</Action>
      </ActionDeck>
    </Panel>
  );
}

/** The form, or the unsubscribe key when the page was opened from a mail's unsubscribe link. */
function SignalForm({ request }: { request: ReturnType<typeof useSignalSubscription> }) {
  const form = <SignalSubscribeForm request={request} />;
  return <Suspense fallback={form}><UnsubscribeSwitch>{form}</UnsubscribeSwitch></Suspense>;
}

function UnsubscribeSwitch({ children }: { children: ReactNode }) {
  // Null outside the app router (component tests render the form alone).
  const search = useSearchParams() as URLSearchParams | null;
  const s = search?.get('s'), t = search?.get('t');
  return s && t ? <SignalUnsubscribe link={{ s, t }} /> : children;
}

function SignalSubscribeForm({
  request,
}: {
  request: ReturnType<typeof useSignalSubscription>;
}) {
  const {
    fields,
    setFields,
    pending,
    done,
    error,
    setError,
    submit,
    errorCode,
  } = request;
  return (
    <FormPanel title="소식 신청서" code="SIGNAL" label="Form">
      {done ? (
        <FormSuccess>
          <p className={ui.eyebrow}>CONTACT SAVED</p>
          <h2>소식 신청을 저장했습니다</h2>
          <p>인스타그램 소식은 팔로워에게만 닿습니다.</p>
          <ActionDeck>
            <Action primary external href={instagram.url}>{instagram.printed} 팔로우</Action>
            <Action href="/">홈으로 돌아가기</Action>
          </ActionDeck>
        </FormSuccess>
      ) : (
        <form aria-busy={pending} onSubmit={submit} className={formStyles.form}>
          <FormError message={error ? errorMessage(error) : ''} />
          <fieldset disabled={pending} className={formStyles.fields}>
            <Field
              id="signal-email"
              label="이메일"
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              value={fields.email}
              error={
                errorCode === 'INVALID_EMAIL_FORMAT'
                  ? errorMessage(error)
                  : undefined
              }
              onChange={(event) => {
                setFields({ ...fields, email: event.target.value });
                if (errorCode === 'INVALID_EMAIL_FORMAT') setError(null);
              }}
            />
            <Field
              id="signal-instagram"
              label="인스타그램 ID (선택)"
              hint="적어 두면 인스타그램으로도 소식을 보냅니다. 팔로워에게만 닿습니다."
              maxLength={31}
              pattern="@?[A-Za-z0-9_.]{1,30}"
              {...literalInput}
              placeholder="@handle"
              value={fields.instagram}
              error={
                errorCode === 'INVALID_INSTAGRAM_FORMAT'
                  ? errorMessage(error)
                  : undefined
              }
              onChange={(event) => {
                setFields({ ...fields, instagram: event.target.value });
                if (errorCode === 'INVALID_INSTAGRAM_FORMAT') setError(null);
              }}
            />
            <Consent
              required
              id="signal-consent"
              checked={fields.consent}
              onChange={(value) => setFields({ ...fields, consent: value })}
            >
              이메일과 (적은 경우) 인스타그램 계정을 TERMINAL 이벤트 소식 안내
              목적으로 수집하는 데 동의합니다. 보존 기간: 수신 거부 시까지.
            </Consent>
            <button
              aria-busy={pending}
              className={`${ui.button} ${ui.primary}`}
            >
              {pending ? '저장 중…' : '소식 신청 저장'}
            </button>
          </fieldset>
        </form>
      )}
    </FormPanel>
  );
}

/** Opened from a mail's unsubscribe link: one key that deletes the subscription the link names. */
function SignalUnsubscribe({ link }: { link: { s: string; t: string } }) {
  const [pending, setPending] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function submit() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const query = new URLSearchParams(link).toString();
      const result = await postJson<{ ok: boolean }>(`/api/signal/unsubscribe?${query}`, {});
      if (result.ok !== true) throw new ApiError('INVALID_RESPONSE', 200);
      setDone(true);
    } catch (error) {
      setError(error);
    } finally {
      setPending(false);
    }
  }
  return (
    <FormPanel title="수신 거부" code="SIGNAL" label="Form">
      {done ? (
        <FormSuccess>
          <p className={ui.eyebrow}>UNSUBSCRIBED</p>
          <h2>수신 거부했습니다</h2>
          <p>이 주소로는 더 이상 TERMINAL 소식을 보내지 않으며, 저장된 연락처를 지웠습니다. You will no longer receive TERMINAL news.</p>
          <ActionDeck>
            <Action href="/">홈으로 돌아가기</Action>
          </ActionDeck>
        </FormSuccess>
      ) : (
        <div className={formStyles.form}>
          <FormError message={error ? errorMessage(error) : ''} />
          <p>이 메일 주소로 TERMINAL 이벤트 소식을 더 받지 않으려면 아래 키를 눌러 주세요. 저장된 연락처도 함께 지웁니다.</p>
          <p className={ui.muted}>Press the key below to stop receiving TERMINAL news at this address.</p>
          <ActionDeck>
            <button type="button" aria-busy={pending} disabled={pending} onClick={submit} className={`${ui.button} ${ui.primary}`}>
              {pending ? '처리 중…' : '수신 거부 · Unsubscribe'}
            </button>
          </ActionDeck>
        </div>
      )}
    </FormPanel>
  );
}
