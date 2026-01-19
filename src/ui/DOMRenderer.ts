import { uniqueId } from '../utils/commonUtils';
import { setCSS } from '../utils/domUtils';

export function query(id: string): HTMLElement | null {
  return document.getElementById(id);
}
export function createElement(tag: string, props = {} satisfies Record<string, string>): HTMLElement {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

export function applyStyles(element: HTMLElement | Element, styles: Record<string, string | number>) {
  setCSS(element, styles);
}

export function generateId(prefix = 'el') {
  return uniqueId(prefix);
}
