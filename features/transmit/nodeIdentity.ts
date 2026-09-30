const NODE_KEY = 'terminal_node_id';
/** Letters and digits without the look-alikes O/0 and I/1 (the alphabet names were first issued in). */
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const NODE_PATTERN = /^NODE-[A-Z0-9]{5,6}$/;

export const isNodeName = (value: string) => NODE_PATTERN.test(value);

/** Five characters of the node alphabet, from `next` (a source of numbers in [0, 1)). */
export const nodeName = (next: () => number = Math.random) =>
  `NODE-${Array.from({ length: 5 }, () => CHARS[Math.floor(next() * CHARS.length)]).join('')}`;

/**
 * This browser's visitor node name, made once and kept. Without storage (a private window, blocked
 * site data) the name lasts for this page only.
 */
let fallback = '';
export function getNodeName(): string {
  try {
    const stored = localStorage.getItem(NODE_KEY);
    if (stored && isNodeName(stored)) return stored;
    const name = nodeName();
    localStorage.setItem(NODE_KEY, name);
    return name;
  } catch {
    return (fallback ||= nodeName());
  }
}

/** A node name of the same form derived from a log id, for records left under another handle. */
export function nodeNameOf(id: string) {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return nodeName(() => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507) >>> 0;
    return hash / 2 ** 32;
  });
}
