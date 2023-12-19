const units = {
  μs: 1,
  ms: 1000,
  s: 1000 * 1000,
  m: 1000 * 1000 * 60,
  h: 1000 * 1000 * 60 * 60,
  d: 1000 * 1000 * 60 * 60 * 24,
  w: 1000 * 1000 * 60 * 60 * 24 * 7,
} as const

export default function parse(
  str: string,
  returnUnit: keyof typeof units = 'ms',
) {
  var totalMicroseconds = 0

  var groups = str.toLowerCase().match(/[-+]?[0-9\.]+[a-z]+/g)

  if (groups !== null) {
    groups.forEach(function (g) {
      var value = parseFloat(g.match(/[0-9\.]+/g)![0])
      var unit = g.match(/[a-z]+/g)![0] as keyof typeof units

      totalMicroseconds += getMicroseconds(value, unit)
    })
  }

  return totalMicroseconds / units[returnUnit]
}

function getMicroseconds(value: number, unit: keyof typeof units) {
  var result = units[unit]

  if (result) {
    return value * result
  }

  throw new Error('The unit "' + unit + '" could not be recognized')
}
