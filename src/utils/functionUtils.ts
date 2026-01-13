export function debounce<T extends (...args: any[]) => any>(func: T, timeout = 150) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(undefined, args as any);
    }, timeout);
  };
}

export function debounceLeading<T extends (...args: any[]) => any>(func: T, timeout = 150) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (!timer) {
      func.apply(undefined, args as any);
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
    }, timeout);
  };
}
