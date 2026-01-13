import { setCSS } from '../utils/domUtils.js';
import { uniqueId } from '../utils/commonUtils.js';

export function query(id) {
  return document.getElementById(id);
}
export function createElement(tag, props = {}) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

export function applyStyles(element, styles) {
  setCSS(element, styles);
}

export function generateId(prefix = 'el') {
  return uniqueId(prefix);
}
