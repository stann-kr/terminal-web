import { getFutureUpcomingEvent, getRequestWindowState } from '@/lib/events/lifecycle';
import { ACCESS_WINDOW_DAYS } from '@/lib/gate/requestPolicy';
import type { ScreenProps } from './data';

export function requestAvailable({ event, events, now }: Pick<ScreenProps, 'event' | 'events' | 'now'>) {
  return Boolean(event && event.id === getFutureUpcomingEvent(events, now)?.id && getRequestWindowState(event, ACCESS_WINDOW_DAYS, now).isActive);
}

/** Select complete source units; never manufacture copy or cut a sentence mid-way. */
export function sourceExcerpt(paragraphs: string[], lang: string, budget: number): string[] {
  const segmenter = new Intl.Segmenter(lang, { granularity: 'sentence' });
  const excerpt: string[] = [];
  let remaining = budget;
  for (const paragraph of paragraphs) {
    const sentences: string[] = [];
    for (const unit of segmenter.segment(paragraph)) {
      const sentence = unit.segment.trim();
      if (!sentence) continue;
      if (sentence.length > remaining) {
        if (sentences.length) excerpt.push(sentences.join(' '));
        return excerpt;
      }
      sentences.push(sentence);
      remaining -= sentence.length + 1;
    }
    if (sentences.length) excerpt.push(sentences.join(' '));
  }
  return excerpt;
}
