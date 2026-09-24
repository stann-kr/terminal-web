import type { TerminalEvent } from '@/lib/events/types';
import { archiveDirectoryHref, eventHref, orderEventDirectory, statusLabel } from '@/features/events/model';

export type CommandResult = { text: string; href?: string; clear?: boolean; error?: boolean };
export const commandDirectory = [
  ['events','이벤트 목록'],
  ['artists','아티스트 목록'],
  ['archive','지난 행사 기록'],
  ['ls','행사 ID 보기'],
  ['open <ID>','행사 상세 열기'],
  ['clear','화면 지우기'],
  ['help','명령어 안내'],
] as const;
const help = commandDirectory.map(([command,description]) => `${command.padEnd(13)}${description}`).join('\n');

export function runCommand(input: string, events: readonly TerminalEvent[], now = new Date()): CommandResult {
  const [name = '',...args] = input.trim().split(/\s+/);
  const command = name.toLowerCase();
  if (command !== 'open' && args.length) return {text:'사용법을 확인하려면 help를 입력하세요.',error:true};
  switch (command) {
    case 'help': return {text:help};
    case 'events': return {text:'이벤트 목록을 엽니다.',href:'/events'};
    case 'artists': return {text:'아티스트 목록을 엽니다.',href:'/artists'};
    case 'archive': {
      const href = archiveDirectoryHref(events,now);
      return href ? {text:'지난 행사 기록으로 이동합니다.',href} : {text:'아직 지난 행사 기록이 없습니다.'};
    }
    case 'ls': return {text:orderEventDirectory(events,now).map(event => `${event.id}  ${event.session}\n  ${event.date} · ${statusLabel(event.status)}`).join('\n\n') || '공개된 행사가 아직 없습니다.'};
    case 'open': {
      if (!args.length) return {text:'open <행사 ID> — ls로 ID를 확인하세요.',error:true};
      const id = args.join(' ');
      const event = events.find(event => event.id === id) ?? events.find(event => event.id.toLowerCase() === id.toLowerCase());
      return event ? {text:`${event.session} 상세를 엽니다.`,href:eventHref(event.id)} : {text:'해당 행사 ID가 없습니다. ls로 목록을 확인하세요.',error:true};
    }
    case 'clear': return {text:'화면을 지웠습니다.',clear:true};
    default: return {text:'알 수 없는 명령어입니다. help로 목록을 확인하세요.',error:true};
  }
}
