'use client';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { TerminalEvent } from '@/lib/events/types';
import { runCommand } from './commands';
import styles from './terminal.module.css';

type Entry = { id: number; command: string; text: string; error?: boolean };
export function HomeTerminal({ events }: { events: readonly TerminalEvent[] }) {
  const router = useRouter();
  const [input,setInput] = useState('');
  const [entries,setEntries] = useState<Entry[]>([]);
  const field = useRef<HTMLInputElement>(null), output = useRef<HTMLDivElement>(null);
  const serial = useRef(0), composing = useRef(false);
  const history = useRef<string[]>([]), position = useRef<number|null>(null), draft = useRef('');
  useEffect(() => {
    if (output.current) output.current.scrollTop = output.current.scrollHeight;
  },[entries]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composing.current || !input.trim()) return;
    const command = input.trim();
    const result = runCommand(command,events);
    history.current = [...history.current,command].slice(-30);
    position.current = null; draft.current = ''; setInput('');
    const entry = {id:serial.current++,command,text:result.text,error:result.error};
    setEntries(previous => result.clear ? [{...entry,command:''}] : [...previous,entry].slice(-30));
    if (result.href) router.push(result.href);
    else field.current?.focus();
  }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || composing.current || event.keyCode === 229) {
      if (event.key === 'Enter') event.preventDefault();
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowUp','ArrowDown'].includes(event.key) || !history.current.length) return;
    event.preventDefault();
    if (position.current === null) {
      if (event.key === 'ArrowDown') return;
      draft.current = input;
    }
    const next = event.key === 'ArrowUp' ? Math.max(0,(position.current ?? history.current.length)-1) : (position.current ?? history.current.length)+1;
    position.current = next >= history.current.length ? null : next;
    setInput(position.current === null ? draft.current : history.current[position.current]);
  }
  return <div className={styles.terminal} data-readout-live="">
    <div className={styles.banner}><span>TERMINAL / COMMAND</span><i aria-hidden="true"/></div>
    <p id="terminal-help" className={styles.hint}>help · events · artists · archive</p>
    <div ref={output} className={styles.output} role="log" aria-label="명령어 실행 기록" aria-live="polite" aria-relevant="additions" tabIndex={0}>
      {entries.length ? entries.map(entry => <div key={entry.id} className={styles.entry}>
        {entry.command && <p className={styles.command}><span aria-hidden="true">&gt; </span>{entry.command}</p>}
        <pre data-error={entry.error || undefined}>{entry.text}</pre>
      </div>) : <p className={styles.welcome}>명령어를 입력해 탐색하세요.<br/>help로 사용법을 볼 수 있습니다.</p>}
    </div>
    <form className={styles.prompt} aria-label="사이트 명령어" onSubmit={submit}>
      <label htmlFor="terminal-command" className={styles.label}>터미널 명령어</label><span aria-hidden="true">&gt;</span>
      <input ref={field} id="terminal-command" value={input} maxLength={120} aria-describedby="terminal-help" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="help" onChange={event => {setInput(event.target.value);position.current=null;}} onKeyDown={keyDown} onCompositionStart={() => {composing.current=true;}} onCompositionEnd={() => {composing.current=false;}}/>
      <button type="submit">실행</button>
    </form>
  </div>;
}
