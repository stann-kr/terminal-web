import type { CSSProperties } from 'react';
import styles from './ornament.module.css';

// Reference 12's orbital paths and reference 16's cells are decorative, not telemetry.
export function Ornament({ variant = 'orbit', compact = false, active = true }: {
  variant?: 'orbit' | 'circuit' | 'matrix';
  compact?: boolean;
  active?: boolean;
}) {
  return <div aria-hidden="true" className={`${styles.ornament} ${compact ? styles.compact : ''}`} data-active={active}>
    <div className={styles.registration}><i/><i/><i/></div>
    {variant === 'matrix' ? <div className={styles.matrix}>{Array.from({ length: 24 },(_,index) =>
      <i key={index} className={index % 7 === 0 ? styles.node : ''} style={{ '--phase': `${index * -.23}s` } as CSSProperties}/>
    )}</div> : <svg className={styles.drawing} viewBox={variant === 'orbit' ? '0 0 320 180' : '0 0 480 100'} fill="none" focusable="false">
      {variant === 'orbit' ? <>
        <path className={styles.guide} d="M12 90H308M160 12V168M32 24H64M32 24V48M288 24H256M288 24V48M32 156H64M32 156V132M288 156H256M288 156V132"/>
        <circle className={styles.guide} cx="160" cy="90" r="70" strokeDasharray="2 6"/>
        <g className={styles.orbits}>
          <ellipse cx="160" cy="90" rx="114" ry="35" transform="rotate(-24 160 90)"/>
          <ellipse cx="160" cy="90" rx="114" ry="35" transform="rotate(24 160 90)"/>
        </g>
        <ellipse className={styles.guide} cx="160" cy="90" rx="48" ry="64"/>
        <path d="M146 90H174M160 76V104"/>
        <rect className={styles.node} x="248" y="45" width="7" height="7"/>
        <circle className={styles.node} cx="72" cy="132" r="3"/>
        <path className={styles.trace} d="M192 120h38l24 24h35"/>
      </> : <>
        <path className={styles.guide} d="M0 25H480M0 75H480M80 10V90M240 10V90M400 10V90"/>
        <path d="M8 50h76l24-24h70l24 24h78l24 24h58l24-24h86M80 75h72l24-24h64l26-25h62l24 24h48"/>
        <path className={styles.trace} d="M8 50h76l24-24h70l24 24h78l24 24h58l24-24h86"/>
        {[84,202,280,386].map((x,index) => <rect key={x} className={styles.node} x={x-3} y="47" width="6" height="6" style={{ '--phase': `${index * -.6}s` } as CSSProperties}/>)}
        <circle cx="240" cy="50" r="15"/><path d="M233 50h14m-7-7v14"/>
      </>}
    </svg>}
    <div className={styles.ruler}/>
  </div>;
}
