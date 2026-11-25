import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BrandOpening } from '../../../../../packages/preview-ui/src/BrandOpening';
import { createBrandArtwork } from '../../../../../packages/preview-ui/src/brand-artwork';
import { discardBrandBoot, registerBrandBoot } from '../../../../../packages/preview-ui/src/brand-boot';
import {
  brandOpeningDuration,
  startBrandOpening,
} from '../../../../../packages/preview-ui/src/brand-opening';

let callbacks: Map<number, (timestamp: number) => void>;
let frameId: number;
const reveal = vi.fn(),
  complete = vi.fn(),
  start = vi.fn();
function advance(timestamp: number) {
  act(() => {
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach((callback) => callback(timestamp));
  });
}
function contours(logo: Element) {
  return [...logo.querySelectorAll('[data-snail] path')].map((path) => path.getAttribute('d'));
}
function placement(logo: Element) {
  const transform = logo.querySelector('[data-snail]')!.getAttribute('transform')!;
  const [x, y] = transform
    .match(/translate\(([^)]+)\)/)![1]
    .split(' ')
    .map(Number);
  const [angle, pivotX, pivotY] = transform
    .match(/rotate\(([^)]+)\)/)![1]
    .split(' ')
    .map(Number);
  const scale = Number(transform.match(/scale\(([-.\d]+)/)![1]);
  return { x, y, angle, scale, pivot: { x: x + pivotX * scale, y: y + pivotY * scale } };
}
function expectFacingTarget(pose: ReturnType<typeof placement>, target: { x: number; y: number }) {
  const dx = target.x - pose.pivot.x;
  const dy = target.y - pose.pivot.y;
  const distance = Math.hypot(dx, dy);
  const heading = (pose.angle * Math.PI) / 180;
  // The approved silhouette faces left: its transformed forward vector must follow the trip.
  expect(-Math.cos(heading)).toBeCloseTo(dx / distance, 4);
  expect(-Math.sin(heading)).toBeCloseTo(dy / distance, 4);
}
function Homepage({ reduced = false, play = true }: { reduced?: boolean; play?: boolean }) {
  return (
    <div className="preview-showcase">
      <header>
        <a href="/" aria-label="Zelo">
          <BrandOpening
            playIntro={play}
            reducedMotion={reduced}
            onStart={start}
            onReveal={reveal}
            onComplete={complete}
          />
        </a>
      </header>
      <main>
        <button type="button">Explore</button>
      </main>
    </div>
  );
}
function earlyHomepage(play = true) {
  const surface = document.createElement('div');
  surface.className = 'preview-showcase preview-home-boot';
  const iconSlot = document.createElement('span');
  iconSlot.className = 'brand-opening-icon-slot';
  const wordSlot = document.createElement('span');
  wordSlot.className = 'brand-opening-word-slot';
  const reserve = document.createElement('span');
  reserve.className = 'brand-opening-reserve';
  reserve.textContent = 'Zelo';
  wordSlot.append(reserve);
  surface.append(iconSlot, wordSlot);
  document.body.append(surface);
  const artwork = createBrandArtwork('test-boot');
  const controller = startBrandOpening({
    ...artwork,
    surface,
    iconSlot,
    wordSlot,
    reserve,
    play,
    waitingForHost: true,
    onStart() {},
    onReveal() {},
    onComplete() {},
  });
  const release = vi.fn(() => surface.remove());
  registerBrandBoot({ controller, release });
  return { surface, controller, release, ...artwork };
}
beforeEach(() => {
  callbacks = new Map();
  frameId = 0;
  reveal.mockReset();
  complete.mockReset();
  start.mockReset();
  vi.stubGlobal('requestAnimationFrame', (callback: (timestamp: number) => void) => {
    callbacks.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('brand-opening-icon-slot')
      ? new DOMRect(24, 52, 32, 32)
      : new DOMRect(64, 52, 65, 32);
  });
  document.documentElement.style.removeProperty('overflow');
});
afterEach(async () => {
  cleanup();
  discardBrandBoot();
  await act(async () => {});
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty('overflow');
});

it('keeps a single brand while opening and releases the page after the complete timeline', () => {
  const view = render(
    <StrictMode>
      <Homepage />
    </StrictMode>,
  );
  const surface = view.container.querySelector('.preview-showcase') as HTMLElement;
  const header = view.container.querySelector('header')!;
  const symbol = surface.querySelector('.brand-opening-symbol')!;
  const originalContours = contours(symbol);
  expect(surface.dataset.brandOpening).toBe('true');
  expect(header.inert).toBe(true);
  expect(document.documentElement.style.overflow).toBe('hidden');
  expect(surface.querySelectorAll('.brand-opening-symbol')).toHaveLength(1);
  expect(surface.querySelectorAll('.brand-opening-word')).toHaveLength(1);
  const word = surface.querySelector<HTMLElement>('.brand-opening-word')!;
  expect(word.style.getPropertyValue('--brand-word-reveal')).toBe('0');
  advance(0);
  advance(300);
  const snail = symbol.querySelector<SVGGElement>('[data-snail]')!;
  expect(Number(snail.style.opacity)).toBeGreaterThan(0);
  expect(Number(snail.style.opacity)).toBeLessThan(1);
  expect(Number(word.style.getPropertyValue('--brand-word-reveal'))).toBeGreaterThan(0);
  expect(symbol.querySelectorAll('[data-snail]')).toHaveLength(1);
  expect(contours(symbol)).toEqual(originalContours);
  advance(brandOpeningDuration);
  expect(contours(symbol)).toEqual(originalContours);
  expect(word.style.getPropertyValue('--brand-word-reveal')).toBe('');
  expect(surface.dataset.brandOpening).toBeUndefined();
  expect(header.inert).toBe(false);
  expect(document.documentElement.style.overflow).toBe('');
  expect(symbol).not.toHaveAttribute('data-floating');
  expect(surface.querySelector('.brand-opening-icon-slot')?.contains(symbol)).toBe(true);
  expect(
    surface.querySelector('.brand-opening-word-slot')?.contains(surface.querySelector('.brand-opening-word')),
  ).toBe(true);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledTimes(1);
  expect(callbacks.size).toBe(0);
  view.rerender(
    <StrictMode>
      <Homepage play={false} />
    </StrictMode>,
  );
  expect(callbacks.size).toBe(0);
  expect(complete).toHaveBeenCalledTimes(1);
});

it('aims before accelerating, lands on its pivot and straightens without deforming or turning the wordmark', () => {
  const boot = earlyHomepage();
  const originalContours = contours(boot.logo);
  const trail = boot.logo.querySelector<SVGGElement>('[data-speed-trail]')!;
  const poses: ReturnType<typeof placement>[] = [];
  advance(0);
  expect(placement(boot.logo).x).toBeGreaterThan(window.innerWidth);
  advance(360);
  const drift = placement(boot.logo);
  expect(drift.angle).toBeLessThan(-8);
  expect(Number(trail.style.opacity)).toBeGreaterThan(0);
  advance(650);
  const settled = placement(boot.logo);
  expect(drift.x).toBeLessThan(settled.x);
  expect(settled.angle).toBe(0);
  expect(trail.style.opacity).toBe('0');
  advance(930);
  expect(placement(boot.logo)).toEqual(settled);
  advance(1040);
  const turning = placement(boot.logo);
  expect(turning.angle).toBeGreaterThan(0);
  advance(1150);
  poses.push(placement(boot.logo));
  expect(poses[0].x).toBeGreaterThan(settled.x);
  expect(poses[0].angle).toBeGreaterThan(turning.angle);
  expectFacingTarget(poses[0], { x: 40, y: 78.25 });
  [1350, 1550, 1750].forEach((timestamp) => {
    advance(timestamp);
    poses.push(placement(boot.logo));
    expect(contours(boot.logo)).toEqual(originalContours);
    expect(boot.word.style.transform).not.toContain('rotate');
    if (timestamp < 1750) {
      expect(Number(trail.style.opacity)).toBeGreaterThan(0);
      expect(Number(trail.style.opacity)).toBeLessThanOrEqual(0.3);
      expectFacingTarget(placement(boot.logo), { x: 40, y: 78.25 });
      expect(trail.getAttribute('transform')).toBe(
        boot.logo.querySelector('[data-snail]')!.getAttribute('transform'),
      );
    }
    expect(placement(boot.logo).angle).toBe(poses[0].angle);
  });
  const distances = poses
    .slice(1)
    .map((pose, index) =>
      Math.hypot(pose.pivot.x - poses[index].pivot.x, pose.pivot.y - poses[index].pivot.y),
    );
  expect(distances[1]).toBeGreaterThan(distances[0]);
  expect(distances[2]).toBeGreaterThan(distances[1]);
  const landed = poses[3];
  expect(landed).toMatchObject({ x: 24, y: 52, scale: 32 / 512, pivot: { x: 40, y: 78.25 } });
  expect(landed.angle).toBeGreaterThan(0);
  expect(trail.style.opacity).toBe('0');
  advance(1900);
  const straightening = placement(boot.logo);
  expect(straightening.pivot).toEqual(landed.pivot);
  expect(straightening.angle).toBeGreaterThan(0);
  expect(straightening.angle).toBeLessThan(landed.angle);
  advance(2050);
  expect(placement(boot.logo)).toEqual({ ...landed, angle: 0 });
  expect(boot.word.style.transform).not.toContain('rotate');
  advance(brandOpeningDuration);
  expect(contours(boot.logo)).toEqual(originalContours);
  expect(trail.style.opacity).toBe('0');
  expect(trail).not.toHaveAttribute('transform');
});

it('recomputes the target heading on resize, including a centered mobile header to the right of the starting pivot', () => {
  vi.stubGlobal('innerWidth', 1440);
  vi.stubGlobal('innerHeight', 900);
  const boot = earlyHomepage();
  advance(0);
  advance(1150);
  const desktop = placement(boot.logo);
  expectFacingTarget(desktop, { x: 40, y: 78.25 });
  expect(desktop.angle).toBeGreaterThan(0);
  expect(desktop.angle).toBeLessThan(90);

  vi.stubGlobal('innerWidth', 390);
  vi.stubGlobal('innerHeight', 844);
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('brand-opening-icon-slot')
      ? new DOMRect(142.5, 34, 32, 32)
      : new DOMRect(182.5, 34, 65, 32);
  });
  fireEvent(window, new Event('resize'));
  const mobile = placement(boot.logo);
  expectFacingTarget(mobile, { x: 158.5, y: 60.25 });
  expect(mobile.angle).toBeGreaterThan(90);
  expect(mobile.angle).not.toBe(desktop.angle);
  advance(1450);
  expectFacingTarget(placement(boot.logo), { x: 158.5, y: 60.25 });
  advance(1750);
  const landed = placement(boot.logo);
  expect(landed.pivot).toEqual({ x: 158.5, y: 60.25 });
  expect(landed.angle).toBe(mobile.angle);
  advance(2050);
  expect(placement(boot.logo)).toEqual({ ...landed, angle: 0 });
  advance(brandOpeningDuration);
  expect(boot.logo).not.toHaveAttribute('data-floating');
  expect(boot.logo.querySelector('[data-snail]')).not.toHaveAttribute('transform');
  expect(boot.surface.querySelector('.brand-opening-icon-slot')?.contains(boot.logo)).toBe(true);
});

it('skips from the keyboard and puts focus on the restored brand link', () => {
  const view = render(<Homepage />);
  const logo = view.container.querySelector('.brand-opening-symbol')!;
  const originalContours = contours(logo);
  advance(0);
  advance(550);
  expect(contours(logo)).toEqual(originalContours);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(contours(logo)).toEqual(originalContours);
  expect(screen.getByRole('link', { name: 'Zelo' })).toHaveFocus();
  expect(screen.queryByRole('button', { name: '跳过开场' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Explore' }).closest('main')?.inert).toBe(false);
  expect(callbacks.size).toBe(0);
});

it('restores existing scroll, contour and inert state when a route unmounts during opening', async () => {
  document.documentElement.style.setProperty('overflow', 'scroll', 'important');
  const view = render(<Homepage />);
  const logo = view.container.querySelector('.brand-opening-symbol')!;
  const originalContours = contours(logo);
  advance(0);
  advance(180);
  expect(contours(logo)).toEqual(originalContours);
  view.unmount();
  await act(async () => {});
  expect(contours(logo)).toEqual(originalContours);
  expect(document.documentElement.style.overflow).toBe('scroll');
  expect(document.documentElement.style.getPropertyPriority('overflow')).toBe('important');
  expect(callbacks.size).toBe(0);
  expect(document.querySelector('.brand-opening-layer')).not.toBeInTheDocument();
});

it('finishes immediately when reduced motion is selected during an opening', () => {
  const view = render(<Homepage />);
  const logo = view.container.querySelector('.brand-opening-symbol')!;
  const originalContours = contours(logo);
  advance(0);
  advance(250);
  expect(contours(logo)).toEqual(originalContours);
  view.rerender(<Homepage reduced />);
  expect(contours(logo)).toEqual(originalContours);
  expect(callbacks.size).toBe(0);
  expect(view.container.querySelector('[data-brand-opening]')).not.toBeInTheDocument();
  expect(view.container.querySelectorAll('[data-floating]')).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Explore' }).closest('main')?.inert).toBe(false);
  expect(complete).toHaveBeenCalledTimes(1);
});

it('pauses a hidden tab without consuming its remaining opening time', () => {
  const view = render(<Homepage />);
  const symbol = view.container.querySelector('[data-snail]')!;
  advance(0);
  advance(500);
  const visiblePose = symbol.getAttribute('transform');
  const visibleContours = contours(view.container.querySelector('.brand-opening-symbol')!);
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  fireEvent(document, new Event('visibilitychange'));
  expect(callbacks.size).toBe(0);
  advance(5000);
  expect(symbol.getAttribute('transform')).toBe(visiblePose);
  expect(contours(view.container.querySelector('.brand-opening-symbol')!)).toEqual(visibleContours);
  hidden.mockReturnValue(false);
  fireEvent(document, new Event('visibilitychange'));
  advance(6000);
  expect(symbol.getAttribute('transform')).toBe(visiblePose);
  advance(6200);
  expect(symbol.getAttribute('transform')).not.toBe(visiblePose);
  expect(contours(view.container.querySelector('.brand-opening-symbol')!)).toEqual(visibleContours);
  expect(complete).not.toHaveBeenCalled();
});

it('restores content once during docking and completes without repeating the reveal', () => {
  render(<Homepage />);
  advance(0);
  advance(2100);
  expect(reveal).toHaveBeenCalledTimes(1);
  advance(brandOpeningDuration);
  expect(reveal).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledTimes(1);
});

it('shows a usable homepage without scheduling animation on a reduced-motion visit', () => {
  const originalContours = contours(createBrandArtwork('reduced-reference').logo);
  const view = render(
    <StrictMode>
      <Homepage reduced />
    </StrictMode>,
  );
  expect(callbacks.size).toBe(0);
  expect(screen.queryByRole('button', { name: '跳过开场' })).not.toBeInTheDocument();
  expect(view.container.querySelectorAll('[data-floating]')).toHaveLength(0);
  expect(contours(view.container.querySelector('.brand-opening-symbol')!)).toEqual(originalContours);
  expect(
    [...view.container.querySelectorAll<HTMLElement>('[data-letter]')].every(
      (letter) => letter.style.opacity === '1',
    ),
  ).toBe(true);
  expect(screen.getByRole('button', { name: 'Explore' }).closest('main')?.inert).toBe(false);
  expect(reveal).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(start).not.toHaveBeenCalled();
});

it('keeps the early brand and elapsed clock when the real header takes over', () => {
  const boot = earlyHomepage();
  const originalContours = contours(boot.logo);
  advance(0);
  advance(300);
  const entrance = boot.logo.querySelector('[data-snail]')!.getAttribute('transform');
  const gesturingContours = contours(boot.logo);
  expect(gesturingContours).toEqual(originalContours);
  const view = render(
    <StrictMode>
      <Homepage />
    </StrictMode>,
  );
  expect(boot.release).toHaveBeenCalledTimes(1);
  expect(boot.surface).not.toBeInTheDocument();
  expect(view.container.querySelector('.brand-opening-symbol')).toBe(boot.logo);
  expect(view.container.querySelector('.brand-opening-word')).toBe(boot.word);
  expect(document.querySelectorAll('.brand-opening-symbol')).toHaveLength(1);
  expect(boot.logo.querySelector('[data-snail]')).toHaveAttribute('transform', entrance);
  expect(contours(boot.logo)).toEqual(gesturingContours);
  advance(500);
  expect(view.container.querySelector('.preview-showcase')).toHaveAttribute('data-brand-phase', 'drift');
  fireEvent(window, new Event('resize'));
  advance(brandOpeningDuration);
  expect(contours(boot.logo)).toEqual(originalContours);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledTimes(1);
  expect(callbacks.size).toBe(0);
  expect(view.container.querySelector('.brand-opening-icon-slot')?.contains(boot.logo)).toBe(true);
});

it('drifts in and sprints to the header while the app loads, then hands over without replaying', () => {
  const boot = earlyHomepage();
  const originalContours = contours(boot.logo);
  advance(0);
  advance(460);
  const gesturingContours = contours(boot.logo);
  expect(gesturingContours).toEqual(originalContours);
  const central = boot.logo.querySelector('[data-snail]')!.getAttribute('transform');
  advance(1450);
  const returningContours = contours(boot.logo);
  expect(returningContours).toEqual(originalContours);
  expect(returningContours).toEqual(gesturingContours);
  expect(boot.surface.dataset.brandPhase).toBe('sprint');
  expect(callbacks.size).toBe(1);
  expect(boot.logo).toHaveAttribute('data-floating', 'true');
  expect(
    [...boot.word.querySelectorAll<HTMLElement>('[data-letter]')].every(
      (letter) => letter.style.opacity === '1',
    ),
  ).toBe(true);
  expect(boot.logo.querySelector('[data-snail]')!.getAttribute('transform')).not.toBe(central);
  const view = render(<Homepage />);
  expect(contours(boot.logo)).toEqual(returningContours);
  advance(1700);
  expect(contours(boot.logo)).toEqual(originalContours);
  expect(contours(boot.logo)).toEqual(returningContours);
  advance(2000);
  expect(contours(boot.logo)).toEqual(originalContours);
  advance(brandOpeningDuration);
  expect(contours(boot.logo)).toEqual(originalContours);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(document.documentElement.style.overflow).toBe('');
  expect(view.container.querySelector('header')?.inert).toBe(false);
});

it('finishes the early opening at the header even when the application arrives after its timeline', () => {
  const boot = earlyHomepage();
  advance(0);
  advance(brandOpeningDuration);
  expect(boot.logo).not.toHaveAttribute('data-floating');
  expect(boot.surface.dataset.brandOpening).toBeUndefined();
  expect(callbacks.size).toBe(0);
  const view = render(<Homepage />);
  expect(view.container.querySelector('.brand-opening-symbol')).toBe(boot.logo);
  expect(boot.release).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(start).not.toHaveBeenCalled();
  expect(callbacks.size).toBe(0);
});

it('shows a complete static early brand for reduced motion and docks it without replaying', () => {
  const originalContours = contours(createBrandArtwork('early-reduced-reference').logo);
  const boot = earlyHomepage(false);
  expect(contours(boot.logo)).toEqual(originalContours);
  expect(callbacks.size).toBe(0);
  expect(boot.logo.style.opacity).toBe('1');
  expect(
    [...boot.logo.querySelectorAll<SVGGElement>('[data-snail]')].every((card) => card.style.opacity === '1'),
  ).toBe(true);
  expect(boot.layer.hidden).toBe(true);
  const view = render(
    <StrictMode>
      <Homepage reduced />
    </StrictMode>,
  );
  expect(view.container.querySelector('.brand-opening-symbol')).toBe(boot.logo);
  expect(boot.logo).not.toHaveAttribute('data-floating');
  expect(contours(boot.logo)).toEqual(originalContours);
  expect(callbacks.size).toBe(0);
  expect(reveal).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(start).not.toHaveBeenCalled();
  expect(document.documentElement.style.overflow).toBe('');
});

it('honors skip before the app is ready without restarting the opening on handoff', () => {
  const boot = earlyHomepage();
  const originalContours = contours(boot.logo);
  advance(0);
  advance(750);
  expect(contours(boot.logo)).toEqual(originalContours);
  fireEvent.click(screen.getByRole('button', { name: '跳过开场' }));
  expect(contours(boot.logo)).toEqual(originalContours);
  expect(callbacks.size).toBe(0);
  expect(document.documentElement.style.overflow).toBe('');
  expect(boot.logo).not.toHaveAttribute('data-floating');
  const view = render(<Homepage />);
  expect(contours(boot.logo)).toEqual(originalContours);
  expect(view.container.querySelectorAll('[data-floating]')).toHaveLength(0);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: '跳过开场' })).not.toBeInTheDocument();
  expect(document.documentElement.style.overflow).toBe('');
});
