/** Approved assets stay byte-for-byte in brand/; opening motion acts on their in-memory copy. */
import iconSource from './brand/zelo-icon-black.svg?raw';
import wordSource from './brand/zelo-wordmark-black.svg?raw';
import './brand-icon.module.css';

function vector(source: string, className: string) {
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  const svg = document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
  svg.querySelectorAll('title, desc').forEach((node) => node.remove());
  svg.removeAttribute('aria-labelledby');
  svg.removeAttribute('role');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', className);
  svg.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  svg.querySelectorAll('[fill="#000000"]').forEach((node) => node.setAttribute('fill', 'currentColor'));
  return svg;
}

export function createBrandArtwork(prefix: string) {
  const iconMount = document.createElement('span');
  const wordMount = document.createElement('span');
  const layerMount = document.createElement('span');
  [iconMount, wordMount, layerMount].forEach((mount) => {
    mount.className = 'brand-opening-mount';
  });
  const logo = vector(iconSource, 'brand-opening-symbol');
  const snail = logo.querySelector('g')!;
  snail.setAttribute('data-snail', '');
  snail.id = `${prefix}-snail`;
  const trail = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  trail.setAttribute('data-speed-trail', '');
  trail.setAttribute('stroke', 'currentColor');
  trail.setAttribute('stroke-width', '6');
  trail.setAttribute('stroke-linecap', 'round');
  trail.style.opacity = '0';
  [
    [474, 590, 302],
    [487, 656, 348],
    [477, 567, 394],
  ].forEach(([x1, x2, y]) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(x1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    trail.append(line);
  });
  logo.insertBefore(trail, snail);
  iconMount.append(logo);
  const word = document.createElement('span');
  word.className = 'brand-opening-word';
  word.setAttribute('aria-hidden', 'true');
  const wordmark = vector(wordSource, 'brand-opening-wordmark');
  [...wordmark.querySelector('g')!.children].forEach((letter, index) => {
    letter.setAttribute('data-letter', String(index));
  });
  word.append(wordmark);
  const preview = document.createElement('span');
  preview.className = 'brand-preview-badge';
  preview.setAttribute('data-brand-preview', '');
  preview.textContent = 'pre';
  word.append(preview);
  wordMount.append(word);
  const layer = document.createElement('div');
  layer.className = 'brand-opening-layer';
  layer.hidden = true;
  const veil = document.createElement('div');
  veil.className = 'brand-opening-veil';
  veil.setAttribute('aria-hidden', 'true');
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'brand-opening-skip';
  skip.textContent = '跳过开场';
  layer.append(veil, skip);
  layerMount.append(layer);
  return { iconMount, wordMount, layerMount, logo, word, layer, veil, skip };
}
