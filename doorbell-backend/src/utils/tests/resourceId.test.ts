import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Request } from 'express'

import { RequestError } from '../requestError.js'
import { resourceIdFromRequest } from '../resourceId.js'

const requestWithParams = (params: Record<string, string>) =>
  ({ params }) as Request

for (const id of ['1', '42', '9007199254740991']) {
  void test(`resourceIdFromRequest accepts positive safe integer ${id}`, () => {
    assert.equal(
      resourceIdFromRequest(requestWithParams({ listingId: id }), 'listingId'),
      id
    )
  })
}

void test('resourceIdFromRequest reads the requested parameter', () => {
  const request = requestWithParams({ listingId: '7', tenantId: '42' })

  assert.equal(resourceIdFromRequest(request, 'listingId'), '7')
  assert.equal(resourceIdFromRequest(request, 'tenantId'), '42')
})

void test('resourceIdFromRequest returns a normalized decimal string', () => {
  assert.equal(
    resourceIdFromRequest(
      requestWithParams({ listingId: '0042' }),
      'listingId'
    ),
    '42'
  )
})

for (const id of [
  undefined,
  '',
  ' ',
  '0',
  '-1',
  '1.5',
  'abc',
  '1abc',
  'NaN',
  'Infinity',
  '9007199254740992',
]) {
  void test(`resourceIdFromRequest rejects invalid ID ${JSON.stringify(id)}`, () => {
    const request = requestWithParams(id === undefined ? {} : { listingId: id })

    assert.throws(
      () => resourceIdFromRequest(request, 'listingId'),
      (error) => {
        assert.ok(error instanceof RequestError)
        assert.equal(error.status, 400)
        assert.equal(error.message, 'error.request.invalid')
        return true
      }
    )
  })
}
