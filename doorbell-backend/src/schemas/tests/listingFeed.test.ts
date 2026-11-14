import assert from 'node:assert/strict'
import { test } from 'node:test'

import { listingFeedQuerySchema } from '../listing.js'

void test('feed query normalizes text, parses decimals and strips unknown fields', () => {
  assert.deepEqual(listingFeedQuerySchema.parse({}), {})
  assert.deepEqual(
    listingFeedQuerySchema.parse({
      city: ' \tHelsinki\u00a0',
      neighborhood: ' Kallio ',
      maxPrice: ' 1250.01 ',
      minSize: '30.50',
      rooms: 'STUDIO',
      unknown: ['ignored'],
    }),
    {
      city: 'Helsinki',
      neighborhood: 'Kallio',
      maxPrice: 1250.01,
      minSize: 30.5,
    }
  )
  assert.deepEqual(
    listingFeedQuerySchema.parse({ city: '\t ', neighborhood: '\n ' }),
    { city: undefined, neighborhood: undefined }
  )
})

void test('feed query accepts inclusive numeric bounds and decimal formats', () => {
  for (const [field, maximum] of [
    ['maxPrice', '99999999.99'],
    ['minSize', '999999.99'],
  ]) {
    for (const value of ['0.01', '1', '1.2', '1.23', '0001.20', maximum]) {
      assert.equal(
        listingFeedQuerySchema.safeParse({ [field]: value }).success,
        true,
        `${field}=${value}`
      )
    }
  }
})

void test('feed query rejects malformed, nonpositive and out-of-range numbers', () => {
  for (const field of ['maxPrice', 'minSize']) {
    for (const value of [
      '',
      ' ',
      '0',
      '0.00',
      '-1',
      '1.001',
      '1.000',
      '1e2',
      '0x10',
      'Infinity',
      'NaN',
      '1,25',
      '10 EUR',
      '+1',
      '.5',
      '1.',
      '100000000',
      '9'.repeat(400),
      10,
      null,
      true,
      ['1'],
      ['1', '2'],
      { value: '1' },
    ]) {
      assert.equal(
        listingFeedQuerySchema.safeParse({ [field]: value }).success,
        false,
        `${field}=${JSON.stringify(value)}`
      )
    }
  }
  assert.equal(
    listingFeedQuerySchema.safeParse({ minSize: '1000000' }).success,
    false
  )
})

void test('feed query rejects structured text and bracket notation', () => {
  for (const field of ['city', 'neighborhood', 'maxPrice', 'minSize']) {
    for (const value of [null, 1, true, ['Helsinki'], { value: 'Helsinki' }]) {
      assert.equal(
        listingFeedQuerySchema.safeParse({ [field]: value }).success,
        false
      )
    }
    for (const suffix of ['[]', '[0]', '[value]']) {
      assert.equal(
        listingFeedQuerySchema.safeParse({ [`${field}${suffix}`]: '1' })
          .success,
        false
      )
    }
  }
})

void test('a nonblank neighborhood requires a nonblank city', () => {
  for (const city of [undefined, '', ' \t ']) {
    const result = listingFeedQuerySchema.safeParse({
      city,
      neighborhood: 'Kallio',
    })
    assert.equal(result.success, false)
    if (!result.success)
      assert.deepEqual(result.error.issues[0].path, ['neighborhood'])
  }
})
