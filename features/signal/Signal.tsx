'use client';
import { Action, PageHeading, Panel, ui } from '@/features/ui/Ui';
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
import { Blocks } from '@/features/display/Blocks';
import { Plate } from '@/features/display/Plate';
import styles from './signal.module.css';
export function Signal() {
  const request = useSignalSubscription();
  return (
    <>
      <PageHeading title="다음 만남의 소식" />
      <div className={styles.layout}>
        <SignalInformation request={request} />
        <SignalForm request={request} />
        <div className={styles.plates}>
          <Plate surface="teal" title="Channel 01" code={'NEXT SESSION NOTICE\nMAIL / INSTAGRAM'} className={styles.fill} />
          <Plate surface="sand" title="Outbound" code="QUEUE / KST" />
          <Plate hatch code="RESERVED" className={styles.hatch} />
        </div>
      </div>
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
    <Panel title="수신 안내" code="SIGNAL">
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
      <Blocks
        cols={8}
        rows={4}
        labels
        motion={pending ? 'scan' : done ? 'still' : 'scan twinkle'}
        step={pending ? 40 : 160}
        tone={error ? 'danger' : pending ? 'sand' : 'mint'}
        lit={done ? Array.from({ length: 32 }, (_, index) => index) : [0, 1, 2, 5, 9, 10, 14, 17, 18, 21, 25, 29, 30]}
        accent={error ? [8, 23] : done ? [] : [8, 23]}
        className={styles.matrix}
      />
      <Action href="/about">소개 / 공식 채널</Action>
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
