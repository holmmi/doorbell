import assert from 'node:assert/strict'
import { test } from 'node:test'

import { locationFilterValues, locationOptions } from '../listingLocations.js'

void test('location choices round-trip to every stored spelling with native whitespace normalization', () => {
  const locations = [
    { city: ' \tHELSINKI\u00a0', neighborhood: '\nKallio\u000b' },
    { city: 'Helsinki', neighborhood: ' kallio ' },
    { city: '\ufeffhelsinki\u3000', neighborhood: 'Kamppi' },
    { city: 'Tampere', neighborhood: 'Kallio' },
    { city: 'Zcity', neighborhood: '\u2000 ' },
    { city: '\u00a0 ', neighborhood: 'Ghost' },
  ]
  const expected = [
    { city: 'HELSINKI', neighborhoods: ['Kallio', 'Kamppi'] },
    { city: 'Tampere', neighborhoods: ['Kallio'] },
    { city: 'Zcity', neighborhoods: [] },
  ]
  assert.deepEqual(locationOptions(locations), expected)
  assert.deepEqual(locationOptions([...locations].reverse()), expected)
  for (const { city, neighborhoods } of expected) {
    for (const neighborhood of [undefined, ...neighborhoods]) {
      const filters = locationFilterValues(locations, { city, neighborhood })
      const matches = locations.filter(
        (location) =>
          filters.cities!.includes(location.city) &&
          (!filters.neighborhoods ||
            filters.neighborhoods.includes(location.neighborhood))
      )
      assert.deepEqual(
        matches,
        locations.filter(
          (location) =>
            location.city.trim().toLowerCase() === city.toLowerCase() &&
            (!neighborhood ||
              location.neighborhood.trim().toLowerCase() ===
                neighborhood.toLowerCase())
        )
      )
      assert.ok(matches.length > 0)
    }
  }
  assert.deepEqual(
    locationFilterValues(locations, { city: 'Unknown' }).cities,
    []
  )
  assert.deepEqual(
    locationFilterValues(locations, { city: 'Tampere', neighborhood: 'Kamppi' })
      .neighborhoods,
    []
  )
  assert.deepEqual(locationFilterValues(locations, {}), {
    cities: undefined,
    neighborhoods: undefined,
  })
  assert.deepEqual(locationOptions([]), [])
})
