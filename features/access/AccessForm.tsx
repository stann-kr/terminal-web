'use client';
import { useEffect, useRef } from 'react';
import type { TerminalEvent } from '@/lib/events/types';
import { eventHref } from '@/features/events/model';
import { Action, ActionDeck, Facts, StateNotice, ui } from '@/features/ui/Ui';
import {
  Consent,
  Field,
  FormError,
  FormSuccess,
  formStyles,
  literalInput,
} from '@/features/ui/Form';
import { errorMessage } from '@/features/ui/http';
import { useAccessRequest } from './useAccessRequest';
import styles from './access.module.css';

export function AccessForm({
  eventId,
  event,
  availability = { canRequest: true, message: '' },
}: {
  eventId: string;
  event?: TerminalEvent;
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
  // A checked code unlocks step 02; the guest carries on typing there.
  const nameField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (verified) nameField.current?.focus();
  }, [verified]);
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
        <Facts
          rows={[
            ...(event ? [['행사', `${event.session} · ${event.date} ${event.time}`] as [string, string]] : []),
            ...(verified ? [['초대인', verified.name] as [string, string]] : []),
            ['이름', fields.name.trim()],
            ['이메일', fields.email.trim()],
            ['인스타그램', `@${fields.instagram.trim().replace(/^@/, '')}`],
            ['소식 수신', fields.marketingConsent ? '동의' : '동의 안 함'],
          ]}
        />
        <ActionDeck>
          <Action primary href={eventHref(eventId)}>행사로 돌아가기</Action>
          {!fields.marketingConsent && <Action href="/signal">다음 행사 소식 신청</Action>}
        </ActionDeck>
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
            {...literalInput}
            enterKeyHint="go"
            onChange={(event) => changeCode(event.target.value)}
            onKeyDown={(event) => {
              // Enter checks the code; the form cannot be sent before that.
              if (event.key !== 'Enter' || event.nativeEvent.isComposing || verified) return;
              event.preventDefault();
              void verifyCode();
            }}
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
        {!verified && availability.canRequest && (
          <p className={styles.locked}>초대 코드를 확인하면 입력할 수 있습니다.</p>
        )}
        <Field
          ref={nameField}
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
