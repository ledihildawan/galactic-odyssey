export function log(
  context = {} satisfies { options?: { dev?: boolean } },
  status: 'log' | 'warn' | 'error' | 'info' = 'log',
  ...message: any[]
) {
  if (context.options?.dev) {
    console?.[status](...message);
  }
}

export function uniqueId(prefix = ''): string {
  return prefix + Date.now().toString(16) + Math.trunc(Math.random() * 100000000).toString(16);
}
