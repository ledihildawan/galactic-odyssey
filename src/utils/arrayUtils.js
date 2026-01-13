export function arrayUnique(array) {
  function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
  }

  return array.filter(onlyUnique);
}

export function arraySortInteger(array, asc = true) {
  return array.sort(function (a, b) {
    return asc ? a - b : b - a;
  });
}
