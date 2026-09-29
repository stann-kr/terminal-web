import type { TerminalEvent } from '@/lib/events/types';
import { buildArtistArchive } from '@/features/artists/model';
import { eventHref, orderEventDirectory, paragraphs, publicArtists, statusLabel } from '@/features/events/model';

/** `navigate` is only ever a fixed site route or eventHref() of a known public event. */
export type CommandResult = { text: string; clear?: boolean; error?: boolean; navigate?: string };
export const commandDirectory = [
  ['events','이벤트 목록 출력'],
  ['artists','아티스트 명단 출력'],
  ['archive','지난 행사 출력'],
  ['ls','행사 ID 보기'],
  ['open <ID>','행사 상세 출력'],
  ['cd <PATH|ID>','화면 이동'],
  ['history','입력 기록 보기'],
  ['clear','화면 지우기'],
  ['help','명령어 안내'],
] as const;
export const routeDirectory = {
  home: '/',
  events: '/events',
  artists: '/artists',
  log: '/transmit',
  signal: '/signal',
  about: '/about',
} as const;
const help = [
  ...commandDirectory.map(([command,description]) => `${command.padEnd(14)}${description}`),
  '',
  `cd PATH       ${Object.keys(routeDirectory).join(' · ')}`,
].join('\n');
const unavailable = '행사 기록을 아직 불러오지 못했습니다. 잠시 후 다시 입력하세요.';
const dataCommands = new Set(['events','artists','archive','ls','open']);

/** Short shell path for a site route: `/` → `~`, `/events/A%3A1` → `~/events/A:1`. */
export function shellPath(pathname: string) {
  if (!pathname || pathname === '/') return '~';
  try { return `~${decodeURIComponent(pathname)}`; } catch { return `~${pathname}`; }
}
function eventList(events: readonly TerminalEvent[]) {
  return events.map(event => `${event.id}  ${event.session}\n  ${statusLabel(event.status)} · ${event.date} ${event.time}\n  ${event.venue}`).join('\n\n');
}
function findEvent(events: readonly TerminalEvent[], id: string) {
  return events.find(event => event.id === id) ?? events.find(event => event.id.toLowerCase() === id.toLowerCase());
}
function changeDirectory(args: string[], events: readonly TerminalEvent[] | null, pathname?: string): CommandResult {
  const raw = args.join(' ') || '~';
  // Route names are a fixed lookup; `~/events` and `/events` mirror the status line.
  const target = raw === '~' || raw === '/' ? 'home' : raw.replace(/^~?\//,'').replace(/\/$/,'');
  const key = target.toLowerCase();
  let href: string | undefined = args.length <= 1 && Object.prototype.hasOwnProperty.call(routeDirectory,key) ? routeDirectory[key as keyof typeof routeDirectory] : undefined;
  let label = '';
  if (!href) {
    if (!events) return {text:unavailable,error:true};
    // Anything else must equal a public event ID (IDs may contain spaces, as with open).
    const event = findEvent(events,target.replace(/^events\//i,''));
    if (!event) return {text:'이동할 경로나 행사 ID가 없습니다. 경로는 home · events · artists · log · signal · about이며 ID는 ls로 확인하세요.',error:true};
    href = eventHref(event.id);
    label = ` · ${event.session}`;
  }
  const path = shellPath(href);
  if (pathname !== undefined && pathname === href) return {text:`${path} — 현재 위치입니다.`};
  return {text:`→ ${path}${label}`,navigate:href};
}
export function runCommand(input: string, events: readonly TerminalEvent[] | null, now = new Date(), context: { language?: 'ko'|'en'; history?: readonly string[]; pathname?: string } = {}): CommandResult {
  const [name = '',...args] = input.trim().split(/\s+/);
  const command = name.toLowerCase();
  if (command === 'cd') return changeDirectory(args,events ? orderEventDirectory(events,now) : null,context.pathname);
  if (command !== 'open' && args.length) return {text:'사용법을 확인하려면 help를 입력하세요.',error:true};
  if (!events && dataCommands.has(command)) return {text:unavailable,error:true};
  const ordered = orderEventDirectory(events ?? [],now);
  switch (command) {
    case 'help': return {text:help};
    case 'events': return {text:eventList(ordered) || '공개된 행사가 아직 없습니다.'};
    case 'artists': {
      const profiles = buildArtistArchive(ordered).sort((a,b) => a.name.localeCompare(b.name,'ko') || a.key.localeCompare(b.key));
      return {text:profiles.map(profile => `${profile.name}${profile.origin ? ` / ${profile.origin}` : ''}`).join('\n') || '공개된 아티스트가 아직 없습니다.'};
    }
    case 'archive': return {text:eventList(ordered.filter(event => event.status === 'ARCHIVED')) || '아직 지난 행사 기록이 없습니다.'};
    case 'ls': return {text:ordered.map(event => `${event.id}  ${event.session}`).join('\n') || '공개된 행사가 아직 없습니다.'};
    case 'open': {
      if (!args.length) return {text:'open <행사 ID> — ls로 ID를 확인하세요.',error:true};
      const event = findEvent(ordered,args.join(' '));
      if (!event) return {text:'해당 행사 ID가 없습니다. ls로 목록을 확인하세요.',error:true};
      const artists = publicArtists(event);
      const description = paragraphs(event.description,context.language ?? 'ko');
      const sections = [eventList([event])];
      if (event.subtitle) sections.push(event.subtitle);
      if (artists.length) sections.push('LINEUP_\n'+artists.map(artist => `${artist.name}${artist.origin ? ` / ${artist.origin}` : ''}\n  ${[artist.dock && `STAGE ${artist.dock}`,artist.time].filter(Boolean).join(' · ')}`).join('\n'));
      if (description.length) sections.push(description.join('\n\n'));
      // open only prints; moving to the record is an explicit cd.
      sections.push(`상세 화면: cd ${event.id}`);
      return {text:sections.join('\n\n')};
    }
    case 'history': return {text:context.history?.map((command,index) => `${String(index+1).padStart(3,'0')}  ${command}`).join('\n') || '입력 기록이 없습니다.'};
    case 'clear': return {text:'화면을 지웠습니다.',clear:true};
    default: return {text:'알 수 없는 명령어입니다. help로 목록을 확인하세요.',error:true};
  }
}
