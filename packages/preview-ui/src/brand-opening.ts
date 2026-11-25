/** One native SVG timeline starts before React and hands the same nodes to the real header. */
export const brandOpeningDuration = 2200;
const timing = {
  entrance: 650,
  recoilStart: 930,
  sprintStart: 1150,
  sprintDuration: 600,
  straightenDuration: 300,
  revealStart: 1750,
  revealDuration: 350,
  letterStart: 220,
  letterDuration: 300,
  letterStagger: 40,
};
const snailPivot = { x: 256, y: 420 };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;
const round = (value: number) => Math.round(value * 100000) / 100000;
const easeOut = (value: number) => 1 - (1 - clamp(value)) ** 3;
const easeInOut = (value: number) => {
  const p = clamp(value);
  return p * p * (3 - 2 * p);
};

/** A single small forward probe. Only rigid transforms change; the approved contour stays intact. */
export function getSnailPose(progress: number) {
  const p = clamp(progress);
  const travel = Math.sin(Math.PI * p);
  return {
    x: round(-32 * travel * travel),
    y: round(-4 * travel * travel),
    angle: round(-1.2 * Math.sin(2 * Math.PI * p) * travel),
  };
}

export interface BrandOpeningHost {
  surface: HTMLElement;
  iconSlot: HTMLElement;
  wordSlot: HTMLElement;
  reserve: HTMLElement;
  skipLabel?: string;
  onStart(): void;
  onReveal(): void;
  onComplete(): void;
}
interface BrandOpeningElements extends BrandOpeningHost {
  iconMount: HTMLElement;
  wordMount: HTMLElement;
  layerMount: HTMLElement;
  logo: SVGSVGElement;
  word: HTMLElement;
  layer: HTMLElement;
  veil: HTMLElement;
  skip: HTMLButtonElement;
  play: boolean;
  waitingForHost?: boolean;
}
export interface BrandOpeningController {
  finish(): void;
  attach(host: BrandOpeningHost): void;
  suspend(): void;
  dispose(): void;
}

/** No React/Motion import here: the first paint must not wait for the application bundle. */
export function startBrandOpening(elements: BrandOpeningElements): BrandOpeningController {
  let { surface, iconSlot, wordSlot } = elements;
  let host: BrandOpeningHost = elements;
  const { iconMount, wordMount, layerMount, logo, word, layer, veil, skip } = elements;
  const snail = logo.querySelector<SVGGElement>('[data-snail]')!;
  const trail = logo.querySelector<SVGGElement>('[data-speed-trail]');
  const letters = [...word.querySelectorAll<SVGElement>('[data-letter]')];
  const root = document.documentElement;
  const readContent = () =>
    [...surface.children].filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child !== iconMount && child !== wordMount && child !== layerMount,
    );
  let content = readContent();
  let inert = content.map((child) => Boolean(child.inert));
  let overflow = root.style.getPropertyValue('overflow');
  let priority = root.style.getPropertyPriority('overflow');
  let locked = false;
  let suspended = false;
  let done = false;
  let disposed = false;
  let revealed = false;
  let time = 0;
  let previous: number | null = null;
  let frame = 0;
  let stage = '';
  let viewport = {
    width: 0,
    height: 0,
    start: { x: 0, y: 0, size: 0 },
    target: { x: 0, y: 0, size: 0 },
    wordFrom: { x: 0, y: 0 },
    wordTo: { x: 0, y: 0 },
    wordScale: 1,
    direction: { x: 1, y: 0, angle: 0 },
  };

  function measure() {
    const target = iconSlot.getBoundingClientRect();
    const wordTarget = wordSlot.getBoundingClientRect();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const brandWidth = Math.max(1, wordTarget.right - target.left);
    const scale = Math.min(width * 0.78, 520, height * 1.2) / brandWidth;
    const left = (width - brandWidth * scale) / 2;
    const centerY = (target.top + target.height / 2 + wordTarget.top + wordTarget.height / 2) / 2;
    const start = { x: left, y: height / 2 + (target.top - centerY) * scale, size: target.width * scale };
    // Aim the same physical pivot that rotates: scaling must not bend the sprint or shift its landing.
    const dx = start.x + (start.size * snailPivot.x) / 512 - target.x - (target.width * snailPivot.x) / 512;
    const dy = start.y + (start.size * snailPivot.y) / 512 - target.y - (target.width * snailPivot.y) / 512;
    const heading = Math.atan2(dy, dx);
    viewport = {
      width,
      height,
      start,
      target: { x: target.x, y: target.y, size: target.width },
      wordFrom: {
        x: left + (wordTarget.left - target.left) * scale,
        y: height / 2 + (wordTarget.top - centerY) * scale,
      },
      wordTo: { x: wordTarget.left, y: wordTarget.top },
      wordScale: scale,
      direction: { x: Math.cos(heading), y: Math.sin(heading), angle: (heading * 180) / Math.PI },
    };
    if (!done) {
      logo.setAttribute('viewBox', `0 0 ${width} ${height}`);
      word.style.width = `${wordTarget.width}px`;
      word.style.height = `${wordTarget.height}px`;
    }
  }
  function restoreSurface() {
    content.forEach((child, index) => {
      child.inert = inert[index];
    });
    if (locked && root.style.getPropertyValue('overflow') === 'hidden') {
      if (overflow) root.style.setProperty('overflow', overflow, priority);
      else root.style.removeProperty('overflow');
    }
    surface.removeAttribute('data-brand-opening');
    surface.removeAttribute('data-brand-phase');
    surface.style.removeProperty('--brand-content-reveal');
    locked = false;
  }
  function lockSurface() {
    surface.dataset.brandOpening = 'true';
    root.style.setProperty('overflow', 'hidden');
    locked = true;
    content.forEach((child) => {
      child.inert = true;
    });
  }
  function resetLetters() {
    letters.forEach((letter) => {
      letter.style.opacity = '1';
      letter.removeAttribute('transform');
    });
  }
  function dock() {
    snail.removeAttribute('transform');
    snail.style.opacity = '1';
    if (trail) {
      trail.style.opacity = '0';
      trail.removeAttribute('transform');
    }
    logo.setAttribute('viewBox', '0 0 512 512');
    logo.removeAttribute('data-floating');
    logo.style.opacity = '1';
    word.removeAttribute('data-floating');
    word.style.transform = '';
    word.style.width = '';
    word.style.height = '';
    word.style.removeProperty('--brand-word-reveal');
    resetLetters();
    iconSlot.append(iconMount);
    wordSlot.append(wordMount);
    layer.hidden = true;
    restoreSurface();
  }
  function finish() {
    if (done || disposed) return;
    cancelAnimationFrame(frame);
    frame = 0;
    previous = null;
    done = true;
    time = brandOpeningDuration;
    dock();
    if (!revealed) {
      revealed = true;
      host.onReveal();
    }
    host.onComplete();
  }
  function paint() {
    const nextStage =
      time < timing.entrance
        ? 'drift'
        : time < timing.sprintStart
          ? 'anticipate'
          : time < timing.revealStart
            ? 'sprint'
            : 'dock';
    if (stage !== nextStage) {
      stage = nextStage;
      surface.dataset.brandPhase = stage;
    }
    // A single backward preload is followed by one accelerating trip; the SVG contour never changes.
    const travel = clamp((time - timing.sprintStart) / timing.sprintDuration);
    const sprint = travel ** 2.4;
    const turn = easeInOut((time - timing.recoilStart) / (timing.sprintStart - timing.recoilStart));
    const recoilX = 12 * turn * viewport.direction.x;
    const recoilY = 12 * turn * viewport.direction.y;
    let x = mix(viewport.start.x + recoilX, viewport.target.x, sprint);
    const y = mix(viewport.start.y + recoilY, viewport.target.y, sprint);
    const scale = mix(viewport.start.size, viewport.target.size, sprint) / 512;
    const straighten = easeInOut((time - timing.revealStart) / timing.straightenDuration);
    let angle = viewport.direction.angle * turn * (1 - straighten);
    if (time < 360) {
      const enter = easeOut(time / 360);
      x = mix(viewport.width + viewport.start.size * 0.2, viewport.start.x - 24, enter);
      angle = -12 * Math.sin((Math.PI / 2) * enter);
    } else if (time < 480) {
      const correct = easeOut((time - 360) / 120);
      x = mix(viewport.start.x - 24, viewport.start.x + 6, correct);
      angle = mix(-12, 4, correct);
    } else if (time < timing.entrance) {
      const settle = easeInOut((time - 480) / (timing.entrance - 480));
      x = mix(viewport.start.x + 6, viewport.start.x, settle);
      angle = mix(4, 0, settle);
    }
    const fade = easeOut(time / 420);
    word.style.setProperty('--brand-word-reveal', String(fade));
    const transform = `translate(${round(x)} ${round(y)}) scale(${round(scale)}) rotate(${round(angle)} ${snailPivot.x} ${snailPivot.y})`;
    snail.setAttribute('transform', transform);
    snail.style.opacity = String(fade);
    if (trail) {
      const entranceTrail = time < timing.entrance ? fade * (1 - easeOut((time - 300) / 350)) : 0;
      const sprintTrail =
        time >= timing.sprintStart ? easeOut(travel / 0.22) * (1 - easeOut((travel - 0.7) / 0.3)) : 0;
      trail.setAttribute('transform', transform);
      trail.style.opacity = String(round(0.3 * Math.max(entranceTrail, sprintTrail)));
    }
    const wordX = mix(viewport.wordFrom.x + recoilX, viewport.wordTo.x, sprint) + 10 * (1 - fade);
    const wordY = mix(viewport.wordFrom.y + recoilY, viewport.wordTo.y, sprint);
    const wordScale = mix(viewport.wordScale, 1, sprint);
    word.style.transform = `translate(${round(wordX)}px,${round(wordY)}px) scale(${round(wordScale)})`;
    letters.forEach((letter, index) => {
      const enter = easeOut(
        (time - timing.letterStart - index * timing.letterStagger) / timing.letterDuration,
      );
      letter.style.opacity = String(enter);
      letter.setAttribute('transform', `translate(0 ${round(8 * (1 - enter))})`);
    });
    const reveal = easeOut((time - timing.revealStart) / timing.revealDuration);
    veil.style.opacity = String(1 - reveal);
    surface.style.setProperty('--brand-content-reveal', String(reveal));
    if (!revealed && time >= timing.revealStart) {
      revealed = true;
      host.onReveal();
    }
    if (time >= timing.revealStart + timing.revealDuration)
      content.forEach((child, index) => {
        child.inert = inert[index];
      });
  }
  function tick(timestamp: number) {
    frame = 0;
    if (done || disposed || suspended || document.hidden) {
      previous = null;
      return;
    }
    if (previous !== null) time = Math.min(brandOpeningDuration, time + timestamp - previous);
    previous = timestamp;
    if (time >= brandOpeningDuration) {
      finish();
      return;
    }
    paint();
    frame = requestAnimationFrame(tick);
  }
  function schedule() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!done && !disposed && !suspended && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function visibility() {
    previous = null;
    schedule();
  }
  function resize() {
    if (disposed || done) return;
    measure();
    paint();
  }
  function focusBrand() {
    iconSlot.closest<HTMLAnchorElement>('a')?.focus({ preventScroll: true });
  }
  function escape(event: KeyboardEvent) {
    if (event.key === 'Escape' && !done) {
      finish();
      focusBrand();
    }
  }
  function skipOpening(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    finish();
    focusBrand();
  }
  skip.textContent = host.skipLabel ?? '跳过开场';
  skip.addEventListener('click', skipOpening);
  const observer = new ResizeObserver(resize);
  observer.observe(iconSlot);
  observer.observe(wordSlot);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', visibility);
  document.addEventListener('keydown', escape);
  iconSlot.append(iconMount);
  wordSlot.append(wordMount);
  surface.append(layerMount);
  measure();
  if (!elements.play) finish();
  else {
    window.scrollTo({ top: 0, behavior: 'instant' });
    surface.append(iconMount, wordMount);
    logo.dataset.floating = 'true';
    word.dataset.floating = 'true';
    layer.hidden = false;
    logo.style.opacity = '1';
    lockSurface();
    paint();
    host.onStart();
    schedule();
  }
  return {
    finish,
    attach(next) {
      if (disposed) return;
      cancelAnimationFrame(frame);
      frame = 0;
      restoreSurface();
      observer.unobserve(iconSlot);
      observer.unobserve(wordSlot);
      surface = next.surface;
      iconSlot = next.iconSlot;
      wordSlot = next.wordSlot;
      host = next;
      stage = '';
      suspended = false;
      content = readContent();
      inert = content.map((child) => Boolean(child.inert));
      overflow = root.style.getPropertyValue('overflow');
      priority = root.style.getPropertyPriority('overflow');
      surface.append(layerMount);
      skip.textContent = host.skipLabel ?? '跳过开场';
      observer.observe(iconSlot);
      observer.observe(wordSlot);
      if (done) {
        dock();
        host.onReveal();
        host.onComplete();
      } else {
        surface.append(iconMount, wordMount);
        lockSurface();
        measure();
        paint();
        host.onStart();
        if (revealed) host.onReveal();
        schedule();
      }
    },
    suspend() {
      suspended = true;
      cancelAnimationFrame(frame);
      frame = 0;
      restoreSurface();
    },
    dispose() {
      if (disposed) return;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('keydown', escape);
      skip.removeEventListener('click', skipOpening);
      done = true;
      dock();
      disposed = true;
      iconMount.remove();
      wordMount.remove();
      layerMount.remove();
    },
  };
}
