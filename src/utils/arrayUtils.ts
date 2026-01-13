export function arrayUnique<T>(array: T[]): T[] {
  function onlyUnique(value: T, index: number, self: T[]) {
    return self.indexOf(value) === index;
  }

  return array.filter(onlyUnique);
}

export function arraySortInteger(array: number[], asc = true): number[] {
  return array.sort(function (a, b) {
    return asc ? a - b : b - a;
  });
}
