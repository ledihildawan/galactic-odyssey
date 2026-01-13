// Minimal DOM renderer placeholder — can be extended or replaced by framework-specific renderer
import { setCSS, uniqueId } from '../utils/helpers.js';

export function query(id) {
  return document.getElementById(id);
}
export function createElement(tag, props = {}) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

/**
 * Apply multiple CSS properties to an element
 */
export function applyStyles(element, styles) {
  setCSS(element, styles);
}

/**
 * Generate unique element ID
 */
export function generateId(prefix = 'el') {
  return uniqueId(prefix);
}
