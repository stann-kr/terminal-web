'use client';
import { Fragment, type ReactNode } from 'react';
import { Action, ActionDeck, Bay, Facts, Panel, ui } from '@/features/ui/Ui';
import {
  Consent,
  Field,
  FormError,
  FormPanel,
  FormSuccess,
  formStyles,
  literalInput,
} from '@/features/ui/Form';
import { errorMessage } from '@/features/ui/http';
import { useSignalSubscription } from './useSignalSubscription';
import styles from './signal.module.css';

/**
 * The channel, the form and the channel state around one subscription request, so all three read
 * the same state. `wrap` places each part (the stage puts each in its own column).
 */
export function SignalBody({ wrap = node => node }: { wrap?: (node: ReactNode) => ReactNode }) {
  const request = useSignalSubscription();
  return (
    <>
      {[
        <SignalInformation key="info" request={request} />,
        <SignalForm key="form" request={request} />,
        <SignalChannel key="channel" request={request} />,
      ].map(part => <Fragment key={part.key}>{wrap(part)}</Fragment>)}
    </>
  );
}
function SignalChannel({ request }: { request: ReturnType<typeof useSignalSubscription> }) {
  return (
    <Panel title="채널 정보" label="Channel" surface="panel" className={styles.channel}>
      <Facts
        rows={[
          ['채널', 'CH 01'],
          ['수신', '이메일 · 인스타그램'],
          ['대상', '다음 행사 소식'],
          ['상태', request.pending ? '전송 중' : request.done ? '등록 완료' : request.error ? '전송 실패' : '대기'],
        ]}
      />
      <Bay label="OUTBOUND / KST" />
    </Panel>
  );
}

function SignalInformation({
  request,
}: {
  request: ReturnType<typeof useSignalSubscription>;
}) {
  const { pending, done, error } = request;
  return (
    <Panel title="수신 안내" label="Signal" code="CH 01" surface="alert">
      <p className={styles.lead}>TERMINAL의 새로운 행사와 소식을 안내합니다.</p>
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

function SignalForm({
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
    <FormPanel title="소식 신청서" code="SIGNAL">
      {done ? (
        <FormSuccess>
          <p className={ui.eyebrow}>CONTACT SAVED</p>
          <h2>소식 신청을 저장했습니다</h2>
          <Action href="/">홈으로 돌아가기</Action>
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
              hint="적어 두면 인스타그램으로도 소식을 보냅니다."
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
