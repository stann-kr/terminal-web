import type { TerminalEvent } from '@/lib/events/types';
import { buildArtistArchive } from '@/features/artists/model';
import { orderEventDirectory, paragraphs, publicArtists, statusLabel } from '@/features/events/model';

export type CommandResult = { text: string; clear?: boolean; error?: boolean };
export const commandDirectory = [
  ['events','이벤트 목록 출력'],
  ['artists','아티스트 명단 출력'],
  ['archive','지난 행사 출력'],
  ['ls','행사 ID 보기'],
  ['open <ID>','행사 상세 출력'],
  ['history','입력 기록 보기'],
  ['clear','화면 지우기'],
  ['help','명령어 안내'],
] as const;
const help = commandDirectory.map(([command,description]) => `${command.padEnd(13)}${description}`).join('\n');
function eventList(events: readonly TerminalEvent[]) {
  return events.map(event => `${event.id}  ${event.session}\n  ${statusLabel(event.status)} · ${event.date} ${event.time}\n  ${event.venue}`).join('\n\n');
}
export function runCommand(input: string, events: readonly TerminalEvent[], now = new Date(), context: { language?: 'ko'|'en'; history?: readonly string[] } = {}): CommandResult {
  const [name = '',...args] = input.trim().split(/\s+/);
  const command = name.toLowerCase();
  if (command !== 'open' && args.length) return {text:'사용법을 확인하려면 help를 입력하세요.',error:true};
  const ordered = orderEventDirectory(events,now);
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
      const id = args.join(' ');
      const event = ordered.find(event => event.id === id) ?? ordered.find(event => event.id.toLowerCase() === id.toLowerCase());
      if (!event) return {text:'해당 행사 ID가 없습니다. ls로 목록을 확인하세요.',error:true};
      const artists = publicArtists(event);
      const description = paragraphs(event.description,context.language ?? 'ko');
      const sections = [eventList([event])];
      if (event.subtitle) sections.push(event.subtitle);
      if (artists.length) sections.push('LINEUP_\n'+artists.map(artist => `${artist.name}${artist.origin ? ` / ${artist.origin}` : ''}\n  ${[artist.dock && `STAGE ${artist.dock}`,artist.time].filter(Boolean).join(' · ')}`).join('\n'));
      if (description.length) sections.push(description.join('\n\n'));
      return {text:sections.join('\n\n')};
    }
    case 'history': return {text:context.history?.map((command,index) => `${String(index+1).padStart(3,'0')}  ${command}`).join('\n') || '입력 기록이 없습니다.'};
    case 'clear': return {text:'화면을 지웠습니다.',clear:true};
    default: return {text:'알 수 없는 명령어입니다. help로 목록을 확인하세요.',error:true};
  }
}
