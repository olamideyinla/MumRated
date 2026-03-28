import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { db } from '../core/database/db'

// Fresh database for each test
beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterEach(() => {
  cleanup()
})
