import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { UserInfo } from '../../types/user.ts'
import { profileChanges, profileToFormValues } from '../profile.ts'

// The exact shape GET /api/user/info returns (docs/api/users.md).
const savedWithPicture: UserInfo = {
  id: '7',
  role: 'TENANT',
  firstName: 'Ada',
  lastName: 'Example',
  email: 'ada@example.com',
  phone: '+358401234567',
  pictureKey: 'users/7/8e952879-0e92-4972-841f-940603b0ead3.png',
  pictureUrl:
    'https://storage.example.com/bucket/users/7/8e952879-0e92-4972-841f-940603b0ead3.png?X-Amz-Signature=abc',
}
const savedWithoutPicture: UserInfo = {
  ...savedWithPicture,
  phone: null,
  pictureKey: null,
  pictureUrl: null,
}

void test('profileChanges sends nothing for an unchanged form', () => {
  const draft = profileToFormValues(savedWithPicture)
  assert.deepEqual(profileChanges(savedWithPicture, draft, false), {})
})

void test('profileChanges removes the picture on its own with pictureKey: null', () => {
  const draft = profileToFormValues(savedWithPicture)
  assert.deepEqual(profileChanges(savedWithPicture, draft, true), {
    pictureKey: null,
  })
})

void test('profileChanges removes the picture together with a name change', () => {
  const draft = {
    ...profileToFormValues(savedWithPicture),
    firstName: 'Grace',
  }
  assert.deepEqual(profileChanges(savedWithPicture, draft, true), {
    firstName: 'Grace',
    pictureKey: null,
  })
})

void test('profileChanges keeps the picture when it is not removed', () => {
  const draft = {
    ...profileToFormValues(savedWithPicture),
    lastName: 'Byron',
  }
  assert.deepEqual(profileChanges(savedWithPicture, draft, false), {
    lastName: 'Byron',
  })
})

void test('profileChanges sends no picture change when there is no picture to remove', () => {
  const draft = profileToFormValues(savedWithoutPicture)
  assert.deepEqual(profileChanges(savedWithoutPicture, draft, true), {})
})

void test('profileChanges never sends the picture URL or protected fields', () => {
  const draft = { firstName: 'Grace', lastName: 'Byron', phone: '' }
  const changes = profileChanges(savedWithPicture, draft, true)
  for (const field of ['pictureUrl', 'id', 'email', 'role'] as const) {
    assert.equal(field in changes, false, `${field} must not be sent`)
  }
})

void test('profileChanges trims names and clears the phone number with null', () => {
  const draft = { firstName: '  Grace ', lastName: 'Example', phone: '   ' }
  assert.deepEqual(profileChanges(savedWithPicture, draft, false), {
    firstName: 'Grace',
    phone: null,
  })
})

void test('profileChanges treats an empty phone as unchanged when none is saved', () => {
  const draft = profileToFormValues(savedWithoutPicture)
  assert.equal(draft.phone, '')
  assert.deepEqual(profileChanges(savedWithoutPicture, draft, false), {})
})
