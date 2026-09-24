export type TerminalEntry = { id: number; command: string; text: string; error?: boolean };
type TerminalSession = { entries: TerminalEntry[]; history: string[]; draft: string; persistent: boolean };
export const TERMINAL_SESSION_KEY = 'terminal.home.session.v1';
const DRAFT_KEY = 'terminal.home.draft.v1';
const LIMIT = 200;
const EMPTY: TerminalSession = {entries:[],history:[],draft:'',persistent:true};

function restore(): TerminalSession {
  try {
    const draft = sessionStorage.getItem(DRAFT_KEY)?.slice(0,120) ?? '';
    let saved: unknown;
    try { saved = JSON.parse(sessionStorage.getItem(TERMINAL_SESSION_KEY) ?? 'null'); } catch { return {...EMPTY,draft}; }
    if (!saved || typeof saved !== 'object') return {...EMPTY,draft};
    const record = saved as Record<string,unknown>;
    if (record.version !== 1 || !Array.isArray(record.entries) || !Array.isArray(record.history)) return {...EMPTY,draft};
    const entries: TerminalEntry[] = record.entries.filter((entry: unknown): entry is Omit<TerminalEntry,'id'> => {
      if (!entry || typeof entry !== 'object') return false;
      const row = entry as Record<string,unknown>;
      return typeof row.command === 'string' && row.command.length <= 120 && typeof row.text === 'string' && (row.error === undefined || typeof row.error === 'boolean');
    }).slice(-LIMIT).map((entry,index) => ({id:index,command:entry.command,text:entry.text,error:entry.error === true}));
    const history = record.history.filter((command: unknown): command is string => typeof command === 'string' && command.length <= 120).slice(-LIMIT);
    return {entries,history,draft,persistent:true};
  } catch { return {...EMPTY,persistent:false}; }
}

// One store per mounted console. Browser storage carries it across route changes/reloads;
// the stable empty server snapshot keeps hydration independent of a prior browser session.
export function createTerminalSessionStore() {
  let current: TerminalSession | undefined;
  const listeners = new Set<() => void>();
  const getSnapshot = () => current ??= restore();
  return {
    getSnapshot,
    getServerSnapshot: () => EMPTY,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => {listeners.delete(listener);}; },
    update: (change: (session: TerminalSession) => TerminalSession) => {
      const previous = getSnapshot();
      const next = change(previous);
      current = {...next,entries:next.entries.length > LIMIT ? next.entries.slice(-LIMIT) : next.entries,history:next.history.length > LIMIT ? next.history.slice(-LIMIT) : next.history};
      try {
        // Draft keystrokes only write a small string, not the entire scrollback.
        if (!previous.persistent || next.entries !== previous.entries || next.history !== previous.history) sessionStorage.setItem(TERMINAL_SESSION_KEY,JSON.stringify({version:1,entries:current.entries,history:current.history}));
        sessionStorage.setItem(DRAFT_KEY,current.draft);
        if (!current.persistent) current = {...current,persistent:true};
      } catch { current = {...current,persistent:false}; }
      listeners.forEach(listener => listener());
    },
  };
}
