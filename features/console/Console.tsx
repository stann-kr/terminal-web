'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { TerminalEvent } from '@/lib/events/types';
import { commandDirectory, runCommand, shellPath } from './commands';
import { createTerminalSessionStore } from './session';
import { PrintedResponse } from './PrintedResponse';
import styles from './terminal.module.css';

export const CONSOLE_INPUT_ID = 'terminal-command';
const OUTPUT_ID = 'terminal-output';

export function Console({ events, language = 'ko', pathname, open = true, onOpenChange }: {
  /** `null` while the public event query has no data; data commands then report it instead of printing zero records. */
  events: readonly TerminalEvent[] | null;
  language?: 'ko'|'en';
  pathname?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [store] = useState(createTerminalSessionStore);
  const session = useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);
  const { entries,history,draft:input } = session;
  const [printQueue,setPrintQueue] = useState<number[]>([]);
  const field = useRef<HTMLInputElement>(null), output = useRef<HTMLDivElement>(null);
  const followOutput = useRef(true);
  const printComplete = useCallback((id?: number) => setPrintQueue(queue => id === undefined ? [] : queue.filter(item => item !== id)),[]);
  const followPrint = useCallback(() => { if (followOutput.current && output.current) output.current.scrollTop = output.current.scrollHeight; },[]);
  const composing = useRef(false), position = useRef<number|null>(null), draft = useRef('');
  const setInput = (value: string) => store.update(session => ({...session,draft:value}));
  useEffect(() => {
    followPrint();
  },[entries,open,followPrint]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composing.current || !input.trim()) return;
    const command = input.trim();
    const commands = [...history,command].slice(-200);
    const result = runCommand(command,events,new Date(),{language,history:commands,pathname});
    position.current = null; draft.current = '';
    const entry = {id:(entries.at(-1)?.id ?? -1)+1,command,text:result.text,error:result.error};
    followOutput.current = true;
    setPrintQueue(queue => result.clear ? [] : [...queue.filter(id => id > entry.id-200),entry.id]);
    store.update(session => ({...session,draft:'',history:commands,entries:result.clear ? [] : [...session.entries,entry]}));
    // Only a folded log becomes an explicit choice; home's default-open log stays a default.
    if (!open) onOpenChange?.(true);
    field.current?.focus();
    if (result.navigate) router.push(result.navigate);
  }
  function isComposing(event: KeyboardEvent) {
    return event.nativeEvent.isComposing || composing.current || event.keyCode === 229;
  }
  function consoleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape' || isComposing(event)) return;
    // First Esc finishes a running print; the next one folds the log back to the prompt line.
    if (printQueue.length) { setPrintQueue([]); return; }
    if (onOpenChange && open) {
      onOpenChange(false);
      field.current?.focus();
    }
  }
  function inputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (isComposing(event)) {
      if (event.key === 'Enter') event.preventDefault();
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowUp','ArrowDown'].includes(event.key) || !history.length) return;
    event.preventDefault();
    if (position.current === null) {
      if (event.key === 'ArrowDown') return;
      draft.current = input;
    }
    const next = event.key === 'ArrowUp' ? Math.max(0,(position.current ?? history.length)-1) : (position.current ?? history.length)+1;
    position.current = next >= history.length ? null : next;
    setInput(position.current === null ? draft.current : history[position.current]);
  }
  return <div className={styles.terminal} data-open={open} data-printing={printQueue.length > 0} onKeyDown={consoleKeyDown}>
    <p id="terminal-help" className={styles.label}>명령어를 입력한 뒤 Enter로 실행합니다. help로 사용법을 확인하고 cd로 화면을 이동합니다. 위·아래 방향키로 이전 입력을 불러오고, Esc로 출력 중인 내용을 펼친 뒤 한 번 더 누르면 출력을 접습니다. 입력 중이 아닐 때 / 키로 이 입력줄로 이동합니다.</p>
    <div id={OUTPUT_ID} className={styles.outputFrame} hidden={!open}>
      <div ref={output} className={styles.output} role="log" aria-label="명령어 실행 기록" aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={event => { const node=event.currentTarget; followOutput.current=node.scrollHeight-node.scrollTop-node.clientHeight < 32; }}>
        {entries.length ? entries.map(entry => <div key={entry.id} className={styles.entry}>
          {entry.command && <p className={styles.command}><span aria-hidden="true">$ </span>{entry.command}</p>}
          <PrintedResponse {...entry} mode={printQueue[0] === entry.id ? 'printing' : printQueue.includes(entry.id) ? 'waiting' : 'done'} onComplete={printComplete} onPrint={followPrint}/>
        </div>) : !history.length && <div className={styles.directory}>
          <p className={styles.directoryLabel}>COMMAND DIRECTORY</p>
          <dl>{commandDirectory.map(([command,description]) => <div key={command}><dt>{command}</dt><dd>{description}</dd></div>)}</dl>
          <p className={styles.ready}>명령어 입력 후 ENTER · 입력줄 바로가기 /</p>
        </div>}
      </div>
    </div>
    <p role="status" className={styles.label}>{history.length > 0 && !entries.length ? '화면을 지웠습니다. 입력 기록은 남아 있습니다.' : ''}</p>
    {!session.persistent && <p className={styles.storageNotice} role="status">기록 저장을 사용할 수 없어 현재 화면에서만 유지됩니다.</p>}
    <form className={styles.prompt} aria-label="사이트 명령어" onSubmit={submit}>
      <label htmlFor={CONSOLE_INPUT_ID} className={styles.label}>터미널 명령어</label>
      <span aria-hidden="true" className={styles.promptLabel}>{pathname !== undefined && <span className={styles.promptPath}>{shellPath(pathname)}</span>}$</span>
      <span className={styles.inputArea} data-empty={input.length === 0}>
        <input ref={field} id={CONSOLE_INPUT_ID} value={input} maxLength={120} aria-describedby="terminal-help" aria-keyshortcuts="/" autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={event => {setInput(event.target.value);position.current=null;}} onKeyDown={inputKeyDown} onCompositionStart={() => {composing.current=true;}} onCompositionEnd={() => {composing.current=false;}}/>
        <i aria-hidden="true" className={styles.cursor}/>
      </span>
      <button type="submit" aria-label="명령어 실행">[ENTER]</button>
      {onOpenChange && <button type="button" className={styles.fold} aria-expanded={open} aria-controls={OUTPUT_ID} onClick={() => onOpenChange(!open)}>
        출력<span aria-hidden="true">{open ? ' ▾' : ' ▴'}</span>
      </button>}
    </form>
  </div>;
}
