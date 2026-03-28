import Papa from 'papaparse'

export function arrayToCsv(headers: string[], rows: string[][]): string {
  return Papa.unparse({ fields: headers, data: rows })
}

export function downloadCsv(filename: string, csvString: string): void {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
