import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'

export function renderWithProviders(
  ui: React.ReactElement,
  { route = '/' } = {},
): RenderResult {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>)
}
