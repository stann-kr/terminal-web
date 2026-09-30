'use client';
import { Action, ActionDeck, Bay, Facts, PageHeading, Panel, ui } from '@/features/ui/Ui';
import {
  Consent,
  Field,
  FormError,
  FormPanel,
  FormSuccess,
  formStyles,
} from '@/features/ui/Form';
import { errorMessage } from '@/features/ui/http';
import { useSignalSubscription } from './useSignalSubscription';
import styles from './signal.module.css';
export function Signal() {
  const request = useSignalSubscription();
  return (
    <>
      <PageHeading title="소식 신청" />
      <div className={styles.layout}>
        <SignalInformation request={request} />
        <SignalForm request={request} />
        <SignalChannel request={request} />
      </div>
    </>
  );
}

export function SignalChannel({ request }: { request: ReturnType<typeof useSignalSubscription> }) {
  return (
    <Panel title="채널 정보" label="Channel" surface="navy" className={styles.channel}>
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

export function SignalInformation({
  request,
}: {
  request: ReturnType<typeof useSignalSubscription>;
}) {
  const { pending, done, error } = request;
  return (
    <Panel title="수신 안내" label="Signal" code="CH 01" surface="red">
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
      <ActionDeck label="INFO" className={styles.deck}>
        <Action href="/about">소개 / 공식 채널</Action>
      </ActionDeck>
    </Panel>
  );
}

export function SignalForm({
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
              label="인스타그램 ID"
              required
              maxLength={31}
              pattern="@?[A-Za-z0-9_.]{1,30}"
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
              이메일·인스타그램 계정을 TERMINAL 이벤트 소식 안내 목적으로
              수집하는 데 동의합니다.
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
