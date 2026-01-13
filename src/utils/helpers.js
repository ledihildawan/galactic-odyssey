// Debounce: ignore all, run the last
export function debounce(func, timeout = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

// Debounce leading: run the first, ignore the rest
export function debounceLeading(func, timeout = 150) {
  let timer;
  return (...args) => {
    if (!timer) {
      func.apply(this, args);
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
    }, timeout);
  };
}

// Get array with unique values
export function arrayUnique(array) {
  function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
  }

  return array.filter(onlyUnique);
}

// Sort array of integers
export function arraySortInteger(array, asc = true) {
  return array.sort(function (a, b) {
    return asc ? a - b : b - a;
  });
}

// Set CSS properties
export function setCSS(target, props) {
  Object.assign(target.style, props);
}

// Console log (dev only)
export function log(context, status, ...message) {
  if (context.options.dev) {
    console?.[status](...message);
  }
}

// Generate unique ID
export function uniqueId(prefix = '') {
  return prefix + (+new Date()).toString(16) + ((Math.random() * 100000000) | 0).toString(16);
}

// Get element offsets
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
