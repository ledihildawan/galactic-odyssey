export function log(
  context: { options?: { dev?: boolean } } = {},
  status: 'log' | 'warn' | 'error' | 'info' = 'log',
  ...message: any[]
) {
  if (context.options?.dev) {
    console?.[status](...message);
  }
}

export function uniqueId(prefix = ''): string {
  return prefix + (+new Date()).toString(16) + ((Math.random() * 100000000) | 0).toString(16);
}
