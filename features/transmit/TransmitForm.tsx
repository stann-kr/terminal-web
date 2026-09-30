'use client';
import { ui } from '@/features/ui/Ui';
import { Field, FormError, formStyles } from '@/features/ui/Form';
import { errorMessage } from '@/features/ui/http';
import { LiveValue } from '@/features/display/Display';
import { Meter } from '@/features/display/Meter';
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
      <div className={styles.counter}>
        <span>MESSAGE LENGTH</span>
        <strong>
          <LiveValue value={String(draft.message.length).padStart(3, '0')} />
          <small>/ 280</small>
        </strong>
      </div>
      <Meter
        segments={28}
        value={Math.ceil((draft.message.length / 280) * 28)}
        busy={pending}
        tone={draft.message.length > 260 ? 'danger' : 'ink'}
        className={styles.gauge}
      />
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
        <textarea
          id="transmit-message"
          required
          maxLength={280}
          rows={5}
          value={draft.message}
          onChange={(event) => edit({ message: event.target.value })}
        />
      </div>
      <Field
        id="transmit-handle"
        label="공개 닉네임 (선택)"
        hint={`비우면 노드 이름${node ? `(${node})` : ''}으로 기록 · 24자 이내 · 공백은 _로 표시됩니다.`}
        placeholder={node}
        maxLength={96}
        autoComplete="nickname"
        value={draft.handle}
        onChange={(event) => edit({ handle: event.target.value })}
      />
      <button
        aria-busy={pending}
        disabled={pending}
        className={`${ui.button} ${ui.primary}`}
      >
        {pending ? '전송 중…' : '기록 전송'}
      </button>
      </div>
    </form>
  );
}
