'use client';
import { Arrow, ui } from '@/features/ui/Ui';
import { Field, FormError, formStyles, literalInput } from '@/features/ui/Form';
import { errorMessage } from '@/features/ui/http';
import { useTransmitPost } from './useTransmitPost';
import styles from './transmit.module.css';

export function TransmitForm({
  onPosted,
  onSaved,
}: {
  onPosted: () => void;
  onSaved?: () => void;
}) {
  const { draft, edit, node, pending, error, receipt, submit } = useTransmitPost({
    onPosted,
    onSaved,
  });
  return (
    <form aria-busy={pending} className={formStyles.form} onSubmit={submit}>
      <p className={styles.intro}>TERMINAL에 남기고 싶은 말을 적어 주십시오. 공개 로그에 바로 올라갑니다.</p>
      <FormError message={error ? errorMessage(error) : ''} />
      {receipt && (
        <div role="status" className={styles.receipt}>
          기록을 저장했습니다. {receipt.handle} · {receipt.ts} KST
        </div>
      )}
      <div className={formStyles.fields}>
      <div className={formStyles.field}>
        <div className={formStyles.fieldHead}>
          <label htmlFor="transmit-message">
            메시지 <span>필수</span>
          </label>
        </div>
        <div className={styles.messageBox}>
          <textarea
            id="transmit-message"
            required
            maxLength={280}
            rows={5}
            aria-describedby="transmit-count"
            value={draft.message}
            onChange={(event) => edit({ message: event.target.value })}
          />
          {/* The length so far, in the field's corner; read with the field, not on every key. */}
          <span id="transmit-count" className={styles.count} data-near={draft.message.length > 260 || undefined}>
            {draft.message.length} / 280<span className={ui.srOnly}>자</span>
          </span>
        </div>
      </div>
      <Field
        id="transmit-handle"
        label="공개 닉네임"
        optional
        hint={`비우면 노드 이름${node ? `(${node})` : ''}으로 기록됩니다. 24자 이내, 공백은 _로 표시됩니다.`}
        placeholder={node}
        maxLength={96}
        {...literalInput}
        autoComplete="nickname"
        value={draft.handle}
        onChange={(event) => edit({ handle: event.target.value })}
      />
      <p className={`${formStyles.hint} ${styles.notice}`}>
        악용 방지를 위해 접속 정보(지역·통신사·암호화한 IP·브라우저·기기·유입 경로)를 90일간 비공개로 보관합니다.
      </p>
      <button
        aria-busy={pending}
        disabled={pending}
        className={`${ui.button} ${ui.primary} ${styles.submit}`}
      >
        {pending ? '남기는 중…' : '기록 남기기'}
        <Arrow />
      </button>
      </div>
    </form>
  );
}
