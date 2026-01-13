export function setCSS(target, props) {
  Object.assign(target.style, props);
}

export function getOffset(element) {
  if (!element.getClientRects().length) {
    return { top: 0, left: 0 };
  }

  const rect = element.getBoundingClientRect();
  const win = element.ownerDocument.defaultView;
  return {
    top: rect.top + win.pageYOffset,
    left: rect.left + win.pageXOffset,
  };
}

export function distanceFromMouseToEl(el, mouseX, mouseY) {
  let centerX = getOffset(el).left + el.offsetWidth / 2,
    centerY = getOffset(el).top + el.offsetHeight / 2,
    pointX = mouseX - centerX,
    pointY = mouseY - centerY,
    distance = Math.sqrt(Math.pow(pointX, 2) + Math.pow(pointY, 2));
  return Math.floor(distance);
}
