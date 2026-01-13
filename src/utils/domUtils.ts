export function setCSS(target: HTMLElement | Element, props: Record<string, string | number>) {
  if ('style' in target) Object.assign((target as HTMLElement).style, props as any);
}

export function getOffset(element: Element) {
  const el = element as HTMLElement;
  if (!el.getClientRects().length) {
    return { top: 0, left: 0 };
  }

  const rect = el.getBoundingClientRect();
  const win = (el.ownerDocument && el.ownerDocument.defaultView) || window;
  return {
    top: rect.top + (win.pageYOffset || 0),
    left: rect.left + (win.pageXOffset || 0),
  };
}

export function distanceFromMouseToEl(el: Element, mouseX: number, mouseY: number) {
  const element = el as HTMLElement;
  const offset = getOffset(element);
  const centerX = offset.left + element.offsetWidth / 2;
  const centerY = offset.top + element.offsetHeight / 2;
  const pointX = mouseX - centerX;
  const pointY = mouseY - centerY;
  const distance = Math.sqrt(Math.pow(pointX, 2) + Math.pow(pointY, 2));
  return Math.floor(distance);
}
