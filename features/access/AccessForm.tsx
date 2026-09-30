'use client';
import { eventHref } from '@/features/events/model';
import { Action, ActionDeck, StateNotice, ui } from '@/features/ui/Ui';
import {
  Consent,
  Field,
  FormError,
  FormSuccess,
  formStyles,
} from '@/features/ui/Form';
import { errorMessage } from '@/features/ui/http';
import { useAccessRequest } from './useAccessRequest';
import styles from './access.module.css';

export function AccessForm({
  eventId,
  availability = { canRequest: true, message: '' },
}: {
  eventId: string;
  availability?: { canRequest: boolean; message: string };
}) {
  const {
    code,
    verified,
    checking,
    pending,
    done,
    error,
    setError,
    codeMessage,
    fields,
    setFields,
    changeCode,
    verifyCode,
    submit,
    errorCode,
    hasDraft,
  } = useAccessRequest(eventId, availability);
  const closed = (
    <StateNotice title="현재 신청할 수 없습니다">
      <p>{availability.message}</p>
      <ActionDeck>
        <Action href="/events">접수 대상 확인</Action>
        <Action href="/signal">소식 신청</Action>
      </ActionDeck>
    </StateNotice>
  );
  if (done)
    return (
      <FormSuccess>
        <p className={ui.eyebrow}>REQUEST SAVED</p>
        <h2>게스트 신청을 저장했습니다</h2>
        <Action href={eventHref(eventId)}>행사로 돌아가기</Action>
      </FormSuccess>
    );
  if (!availability.canRequest && !hasDraft && !pending) return closed;
  return (
    <form aria-busy={pending} onSubmit={submit} className={formStyles.form}>
      {!availability.canRequest && closed}
      <FormError message={error ? errorMessage(error) : ''} />
      <fieldset
        className={formStyles.fields}
        disabled={pending || !availability.canRequest}
      >
        <legend className={`${ui.band} ${styles.legend}`}>01 / 초대 코드 확인</legend>
        <div className={styles.code}>
          <Field
            id="access-code"
            label="초대 코드"
            required
            maxLength={64}
            value={code}
            autoComplete="off"
            onChange={(event) => changeCode(event.target.value)}
          />
          <button
            aria-busy={checking}
            type="button"
            className={ui.button}
            disabled={checking || !code.trim()}
            onClick={() => void verifyCode()}
          >
            {checking ? '확인 중…' : '코드 확인'}
          </button>
        </div>
        <p className={styles.codeMessage} role="status">
          {codeMessage}
        </p>
        {verified && (
          <p className={styles.inviter}>
            초대인 <strong>{verified.name}</strong>
          </p>
        )}
      </fieldset>
      <fieldset
        className={formStyles.fields}
        disabled={!verified || pending || !availability.canRequest}
      >
        <legend className={`${ui.band} ${styles.legend}`}>02 / 연락처와 동의</legend>
        <Field
          id="guest-name"
          label="이름"
          required
          maxLength={100}
          autoComplete="name"
          value={fields.name}
          onChange={(event) =>
            setFields({ ...fields, name: event.target.value })
          }
        />
        <div className={styles.contacts}>
          <Field
            id="guest-email"
            label="이메일"
            type="email"
            required
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
            id="guest-instagram"
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
        </div>
        <div>
          <Consent
            id="privacy-consent"
            checked={fields.privacyConsent}
            required
            onChange={(value) =>
              setFields({ ...fields, privacyConsent: value })
            }
          >
            이름·이메일·인스타그램 ID를 게스트 접근 관리 목적으로 수집합니다.
            보존 기간: 이벤트 종료 후 1개월. 제3자 미공개.
          </Consent>
          <Consent
            id="marketing-consent"
            checked={fields.marketingConsent}
            onChange={(value) =>
              setFields({ ...fields, marketingConsent: value })
            }
          >
            [선택] 차기 이벤트 소식을 이메일·인스타그램 채널로 수신합니다. 보존
            기간: 수신 거부 시까지.
          </Consent>
        </div>
        <button
          aria-busy={pending}
          className={`${ui.button} ${ui.primary}`}
          disabled={pending || !verified || !availability.canRequest}
        >
          {pending ? '신청 저장 중…' : '게스트 신청 저장'}
        </button>
      </fieldset>
    </form>
  );
}
