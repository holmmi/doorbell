import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { getObjectStorage } from '../../config/objectStorage.js'
import {
  createPresignedImageDownload,
  createPresignedImageUpload,
  isProfilePictureKey,
} from '../imageService.js'

Object.assign(process.env, {
  S3_ENDPOINT: 'https://storage.example.com',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY: 'signing-test-access-key',
  S3_SECRET_KEY: 'signing-test-secret-key',
  S3_BUCKET: 'signing-test',
  S3_FORCE_PATH_STYLE: 'true',
})

after(() => getObjectStorage().client.destroy())

void test('profile keys cannot escape the account namespace when signed as URLs', () => {
  for (const key of [
    'users/70/avatar.png',
    'users/7/../8/avatar.png',
    'users/7/%2e%2e/8/avatar.png',
    'users/7/..\\8\\avatar.png',
    'users/7/avatar.png?key=other',
    'listings/7/avatar.png',
    'https://example.com/avatar.png',
  ]) {
    assert.equal(isProfilePictureKey(key, '7'), false)
  }
  assert.equal(isProfilePictureKey('users/7/avatar.jpeg', '7'), true)
})

void test('PUT signatures bind Content-Type and expire after 900 seconds', async () => {
  for (const [contentType, suffix] of [
    ['image/png', 'png'],
    ['image/jpg', 'jpg'],
    ['image/jpeg', 'jpeg'],
  ]) {
    const image = await createPresignedImageUpload(
      'users',
      '9007199254740993',
      contentType
    )
    assert.match(
      image.objectKey,
      new RegExp(`^users/9007199254740993/[0-9a-f-]{36}\\.${suffix}$`)
    )
    const url = new URL(image.uploadUrl)
    assert.equal(url.origin, 'https://storage.example.com')
    assert.equal(url.pathname, `/signing-test/${image.objectKey}`)
    assert.equal(image.expiresIn, 900)
    assert.equal(url.searchParams.get('X-Amz-Expires'), '900')
    assert.equal(url.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256')
    assert.equal(
      url.searchParams.get('X-Amz-SignedHeaders'),
      'content-type;host'
    )
    assert.match(
      url.searchParams.get('X-Amz-Signature') as string,
      /^[a-f0-9]{64}$/
    )
  }
})

void test('GET signatures use fresh signing times, the stored key and a 900-second lifetime', async (t) => {
  t.mock.timers.enable({
    apis: ['Date'],
    now: new Date('2026-11-12T12:00:00Z'),
  })
  const key = 'users/7/picture.png'
  const first = new URL(await createPresignedImageDownload(key))
  t.mock.timers.tick(60_000)
  const second = new URL(await createPresignedImageDownload(key))
  for (const url of [first, second]) {
    assert.equal(url.pathname, `/signing-test/${key}`)
    assert.equal(url.searchParams.get('X-Amz-Expires'), '900')
    assert.equal(url.searchParams.get('X-Amz-SignedHeaders'), 'host')
  }
  assert.equal(first.searchParams.get('X-Amz-Date'), '20261112T120000Z')
  assert.equal(second.searchParams.get('X-Amz-Date'), '20261112T120100Z')
  assert.notEqual(
    first.searchParams.get('X-Amz-Signature'),
    second.searchParams.get('X-Amz-Signature')
  )
})
