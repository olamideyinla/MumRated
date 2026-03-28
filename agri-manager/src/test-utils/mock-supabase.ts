import { vi } from 'vitest'

export function createMockSupabaseChain(defaultData: unknown[] = []) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: defaultData, error: null }),
  }
  return {
    from: vi.fn().mockReturnValue(chain),
    auth: {
      refreshSession: vi.fn().mockResolvedValue({ error: null }),
    },
    _chain: chain,
  }
}
