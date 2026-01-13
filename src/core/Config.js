function detectLocale() {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  if (typeof process !== 'undefined' && process.env.LANG) return process.env.LANG.split('.')[0];
  return 'en-US';
}

function makeShortMonthNames(locale) {
  const months = [];
  for (let m = 0; m < 12; m++) {
    const dt = new Date(2020, m, 1);
    let s = new Intl.DateTimeFormat(locale, { month: 'short' }).format(dt);
    s = s.replace(/\./g, '').toUpperCase().slice(0, 3);
    months.push(s);
  }
  return months;
}

function makeShortWeekdayNames(locale) {
  // Use a known Sunday as base (2023-01-01 is Sunday)
  const days = [];
  for (let d = 0; d < 7; d++) {
    const dt = new Date(Date.UTC(2023, 0, 1 + d));
    let s = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(dt);
    s = s.replace(/\./g, '').toUpperCase().slice(0, 3);
    days.push(s);
  }
  return days;
}

const _locale = detectLocale();

export const OdysseyConfig = {
  temporal: {
    weekStart: 1,
    totalYears: 2000,
    monthsShort: makeShortMonthNames(_locale),
    daysShort: makeShortWeekdayNames(_locale),
  },
  display: { defaultMode: 'structured', centerContent: true, minCols: 7, warpDuration: 1100 },
  audio: {
    basePath: 'assets/sfx/',
    masterVolume: 0.4,
    ambientBaseVolume: 0.12,
    idleInterval: [10000, 25000],
    idleDelay: 30000,
  },
  physics: { cursorInertia: 0.12, hoverThrottle: 120, exhaustThreshold: 15 },
};
