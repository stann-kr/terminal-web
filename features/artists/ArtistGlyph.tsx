import styles from './artists.module.css';

// Three cut bands per letter: a shared stencil construction, not artist metadata.
const stencils: Record<string, readonly string[]> = {
  C: ['M8 0H56V16H18V24H0V8H8Z', 'M0 28H18V52H0Z', 'M0 56H18V64H56V80H8V72H0Z'],
  D: [
    'M0 0H40V8H56V24H38V16H18V24H0Z',
    'M0 28H18V52H0ZM38 28H56V52H38Z',
    'M0 56H18V64H38V56H56V72H40V80H0Z',
  ],
  F: ['M0 0H56V16H18V24H0Z', 'M0 28H48V44H18V52H0Z', 'M0 56H18V80H0Z'],
  L: ['M0 0H18V24H0Z', 'M0 28H18V52H0Z', 'M0 56H18V64H56V80H0Z'],
  M: [
    'M0 0H16V8H24V16H32V8H40V0H56V24H34V32H22V24H0Z',
    'M0 28H16V52H0ZM40 28H56V52H40Z',
    'M0 56H16V80H0ZM40 56H56V80H40Z',
  ],
  N: [
    'M0 0H18V8H28V24H0ZM38 0H56V24H38Z',
    'M0 28H18V52H0ZM24 28H38V36H56V52H38V44H24ZM38 28H56V52H38Z',
    'M0 56H18V80H0ZM28 56H56V80H38V72H28Z',
  ],
  S: [
    'M8 0H56V16H18V24H0V8H8Z',
    'M0 28H18V32H48V40H56V52H38V48H8V40H0Z',
    'M38 56H56V72H48V80H0V64H38Z',
  ],
};

export function ArtistGlyph({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toUpperCase() ?? '');
  const width = initials.length * 56 + (initials.length - 1) * 10;

  return (
    <div
      className={styles.artistGlyph}
      data-readout-instrument=""
      aria-hidden="true"
    >
      <svg viewBox="0 0 160 96" focusable="false">
        {initials.map((letter, index) => (
          <g
            key={index}
            transform={`translate(${(160 - width) / 2 + index * 66} 8)`}
          >
            {stencils[letter] ? (
              stencils[letter].map((path, band) => (
                <path key={band} d={path} className={styles.glyphSegment} />
              ))
            ) : (
              <text
                x="28"
                y="72"
                textAnchor="middle"
                className={styles.glyphFallback}
              >
                {letter}
              </text>
            )}
          </g>
        ))}
      </svg>
      <span className={styles.glyphRail}>
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
