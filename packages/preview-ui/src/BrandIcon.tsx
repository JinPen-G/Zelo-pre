/** Final Zelo silhouette, shared by platform navigation and account entry points. */
import symbol from './brand/zelo-icon-black.svg';
import wordmark from './brand/zelo-wordmark-black.svg';
import styles from './brand-icon.module.css';

export function BrandIcon({ size = 32 }: { size?: number }) {
  return (
    <img
      className={styles.icon}
      src={symbol}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

export function BrandWordmark({ height = 32 }: { height?: number }) {
  return (
    <span className={styles.wordmark} aria-hidden="true">
      <img
        className={styles.icon}
        src={wordmark}
        width={(height * 444) / 220}
        height={height}
        alt=""
        draggable={false}
      />
      <span className="brand-preview-badge">pre</span>
    </span>
  );
}
