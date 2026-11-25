/** The homepage snail follows scroll progress; it has no independent animation clock. */
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { useShouldReduceMotion } from '@animate-ui/react/utils/motion';
import { useMotionValueEvent, type MotionValue } from 'motion/react';
import { createBrandArtwork } from '../../brand-artwork';
import { getSnailPose } from '../../brand-opening';

export function ShuffleLogo({ progress }: { progress: MotionValue<number> }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const mount = useRef<HTMLSpanElement>(null);
  const paint = useRef<((percent: number) => void) | null>(null);
  const reduce = useShouldReduceMotion();
  useMotionValueEvent(progress, 'change', (percent) => paint.current?.(reduce ? 0 : percent));
  useLayoutEffect(() => {
    if (!mount.current) return;
    const { iconMount, logo } = createBrandArtwork(`landing-${id}`);
    iconMount.className = 'home-shuffle-artwork';
    logo.setAttribute('class', 'home-shuffle-symbol');
    const snail = logo.querySelector<SVGGElement>('[data-snail]')!;
    paint.current = (percent) => {
      const position = Math.max(0, Math.min(100, percent));
      if (mount.current) mount.current.dataset.shuffleProgress = String(Math.round(position * 1000) / 1000);
      const { x, y, angle } = getSnailPose(position / 100);
      snail.setAttribute('transform', `translate(${x} ${y}) rotate(${angle} 256 426)`);
    };
    paint.current(0);
    mount.current.append(iconMount);
    return () => {
      paint.current = null;
      iconMount.remove();
    };
  }, [id]);
  useEffect(() => {
    paint.current?.(reduce ? 0 : progress.get());
  }, [progress, reduce]);
  return <span ref={mount} className="home-shuffle-logo" data-trigger="scroll" aria-hidden="true" />;
}
