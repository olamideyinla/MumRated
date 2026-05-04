// Server component, renders 1-5 star rating as SVG icons

interface Props {
  rating: number; // 0–5, supports decimals (e.g. 4.7)
  size?: "sm" | "md" | "lg";
  showNumber?: boolean;
  className?: string;
}

const sizes = { sm: 14, md: 18, lg: 22 };

export default function StarRating({
  rating,
  size = "md",
  showNumber = false,
  className = "",
}: Props) {
  const px = sizes[size];
  const clipped = Math.min(5, Math.max(0, rating));

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      aria-label={`${clipped.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.min(1, Math.max(0, clipped - (i - 1)));
        const pct = Math.round(fill * 100);
        const starId = `star-grad-${i}-${pct}`;
        return (
          <svg
            key={i}
            width={px}
            height={px}
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={starId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset={`${pct}%`} stopColor="#C9A227" />
                <stop offset={`${pct}%`} stopColor="#E0CEB8" />
              </linearGradient>
            </defs>
            <path
              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
              fill={`url(#${starId})`}
            />
          </svg>
        );
      })}
      {showNumber && (
        <span className="ml-1 text-sm font-semibold text-dark">
          {clipped.toFixed(1)}
        </span>
      )}
    </span>
  );
}
