export function log(context, status, ...message) {
  if (context.options.dev) {
    console?.[status](...message);
  }
}

export function uniqueId(prefix = '') {
  return prefix + (+new Date()).toString(16) + ((Math.random() * 100000000) | 0).toString(16);
}
