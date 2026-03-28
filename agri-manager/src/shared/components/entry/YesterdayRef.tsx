interface YesterdayRefProps {
  text: string | null | undefined
}

export function YesterdayRef({ text }: YesterdayRefProps) {
  if (!text) return null
  return (
    <p className="mt-1 text-xs text-gray-400">
      Yesterday: <span className="font-medium">{text}</span>
    </p>
  )
}
