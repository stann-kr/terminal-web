'use client';
import { ui } from '@/features/ui/Ui';
import { Field, FormError, formStyles } from '@/features/ui/Form';
import { errorMessage } from '@/features/ui/http';
import { LiveValue } from '@/features/display/Display';
import { Blocks } from '@/features/display/Blocks';
import { useTransmitPost } from './useTransmitPost';
import styles from './transmit.module.css';

export function TransmitForm({
  onPosted,
  onSaved,
}: {
  onPosted: () => void;
  onSaved?: () => void;
}) {
  const { draft, edit, pending, error, receipt, submit } = useTransmitPost({
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
      <Blocks
        cols={28}
        motion={pending ? 'scan' : 'still'}
        step={50}
        tone={pending ? 'sand' : draft.message.length > 260 ? 'danger' : 'mint'}
        lit={Array.from({ length: Math.ceil((draft.message.length / 280) * 28) }, (_, index) => index)}
        className={styles.gauge}
      />
      <FormError message={error ? errorMessage(error) : ''} />
      {receipt && (
        <div role="status" className={styles.receipt}>
          기록을 저장했습니다. {receipt.handle} · {receipt.ts} KST
        </div>
      )}
      <Field
        id="transmit-handle"
        label="공개 닉네임"
        hint="24자 이내 · 공백은 _로 표시됩니다."
        required
        maxLength={96}
        autoComplete="nickname"
        value={draft.handle}
        onChange={(event) => edit({ handle: event.target.value })}
      />
      <div className={formStyles.field}>
        <label htmlFor="transmit-message">
          메시지 <span>필수</span>
        </label>
        <textarea
          id="transmit-message"
          required
          maxLength={280}
          rows={5}
          value={draft.message}
          onChange={(event) => edit({ message: event.target.value })}
        />
      </div>
      <button
        aria-busy={pending}
        disabled={pending}
        className={`${ui.button} ${ui.primary}`}
      >
        {pending ? '전송 중…' : '기록 전송'}
      </button>
    </form>
  );
}
