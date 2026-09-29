'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from 'react';
import type { TerminalEvent } from '@/lib/events/types';
import { commandDirectory, runCommand } from './commands';
import { createTerminalSessionStore } from './session';
import { PrintedResponse } from './PrintedResponse';
import styles from './terminal.module.css';

export function Console({ events, language = 'ko' }: { events: readonly TerminalEvent[]; language?: 'ko'|'en' }) {
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
  },[entries,followPrint]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composing.current || !input.trim()) return;
    const command = input.trim();
    const commands = [...history,command].slice(-200);
    const result = runCommand(command,events,new Date(),{language,history:commands});
    position.current = null; draft.current = '';
    const entry = {id:(entries.at(-1)?.id ?? -1)+1,command,text:result.text,error:result.error};
    followOutput.current = true;
    setPrintQueue(queue => result.clear ? [] : [...queue.filter(id => id > entry.id-200),entry.id]);
    store.update(session => ({...session,draft:'',history:commands,entries:result.clear ? [] : [...session.entries,entry]}));
    field.current?.focus();
  }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || composing.current || event.keyCode === 229) {
      if (event.key === 'Enter') event.preventDefault();
      return;
    }
    if (event.key === 'Escape') { setPrintQueue([]); return; }
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
  return <div className={styles.terminal} data-readout-live="" data-printing={printQueue.length > 0}>
    <p id="terminal-help" className={styles.label}>명령어를 입력한 뒤 Enter로 실행합니다. help로 사용법을 확인하고 위·아래 방향키로 이전 입력을 불러올 수 있습니다. Esc로 출력 중인 내용을 바로 펼칩니다.</p>
    <div ref={output} className={styles.output} role="log" aria-label="명령어 실행 기록" aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={event => { const node=event.currentTarget; followOutput.current=node.scrollHeight-node.scrollTop-node.clientHeight < 32; }}>
      {entries.length ? entries.map(entry => <div key={entry.id} className={styles.entry}>
        {entry.command && <p className={styles.command}><span aria-hidden="true">CMD&gt; </span>{entry.command}</p>}
        <PrintedResponse {...entry} mode={printQueue[0] === entry.id ? 'printing' : printQueue.includes(entry.id) ? 'waiting' : 'done'} onComplete={printComplete} onPrint={followPrint}/>
      </div>) : !history.length && <div className={styles.directory}>
        <p className={styles.directoryTitle}>TERMINAL / SEOUL</p>
        <p className={styles.directoryLabel}>COMMAND DIRECTORY_</p>
        <dl>{commandDirectory.map(([command,description]) => <div key={command}><dt>{command}</dt><dd>{description}</dd></div>)}</dl>
        <p className={styles.ready}><span aria-hidden="true">&gt;&gt; </span>명령어 입력 후 ENTER</p>
      </div>}
    </div>
    <p role="status" className={styles.label}>{history.length > 0 && !entries.length ? '화면을 지웠습니다. 입력 기록은 남아 있습니다.' : ''}</p>
    {!session.persistent && <p className={styles.storageNotice} role="status">기록 저장을 사용할 수 없어 현재 화면에서만 유지됩니다.</p>}
    <form className={styles.prompt} aria-label="사이트 명령어" onSubmit={submit}>
      <label htmlFor="terminal-command" className={styles.label}>터미널 명령어</label><span aria-hidden="true" className={styles.promptLabel}>CMD&gt;</span>
      <span className={styles.inputArea} data-empty={input.length === 0}>
        <input ref={field} id="terminal-command" value={input} maxLength={120} aria-describedby="terminal-help" autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={event => {setInput(event.target.value);position.current=null;}} onKeyDown={keyDown} onCompositionStart={() => {composing.current=true;}} onCompositionEnd={() => {composing.current=false;}}/>
        <i aria-hidden="true" className={styles.cursor}/>
      </span>
      <button type="submit" aria-label="명령어 실행">[ENTER]</button>
    </form>
  </div>;
}
