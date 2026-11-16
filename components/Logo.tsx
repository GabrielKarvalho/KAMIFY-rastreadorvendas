/** Ícone K do KAMIFY (mesmo desenho do ícone do app). */
export default function Logo({ tamanho = 30 }: { tamanho?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} aria-hidden="true" style={{ borderRadius: tamanho * 0.22, flex: "none" }}>
      <defs>
        <linearGradient id="kamify-kb" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#2f6bff" />
          <stop offset="1" stopColor="#5cc3ff" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="#0f1326" />
      <g strokeLinejoin="round">
        <rect x="24.6" y="23.1" width="16" height="53.9" rx="2" fill="#f4f5f7" />
        <path d="M43.4 41.7 L57.6 41.7 L75.6 25.2 L74.4 23.1 L61.3 23.1 Z" fill="url(#kamify-kb)" stroke="url(#kamify-kb)" strokeWidth="1.6" />
        <path d="M42.4 44.6 L55.2 44.6 L76.4 74.4 L75.2 76.6 L61.4 76.6 L42.4 50.4 Z" fill="#f4f5f7" stroke="#f4f5f7" strokeWidth="1.6" />
      </g>
    </svg>
  );
}
