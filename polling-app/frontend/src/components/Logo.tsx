interface Props {
  size?: number;
  className?: string;
}

/**
 * Quorum brand mark — a gradient squircle with an ascending-bars motif
 * (polling results) topped by a live data point.
 */
export default function Logo({ size = 40, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Quorum"
    >
      <defs>
        <linearGradient id="quorumFill" x1="2" y1="2" x2="46" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="quorumShine" x1="24" y1="2" x2="24" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#quorumFill)" />
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#quorumShine)" />

      {/* ascending result bars */}
      <rect x="13" y="26" width="6" height="9"  rx="3" fill="#ffffff" fillOpacity="0.88" />
      <rect x="21" y="20" width="6" height="15" rx="3" fill="#ffffff" fillOpacity="0.94" />
      <rect x="29" y="14" width="6" height="21" rx="3" fill="#ffffff" />

      {/* live data point */}
      <circle cx="32" cy="9.5" r="2.6" fill="#34d399" />
    </svg>
  );
}
