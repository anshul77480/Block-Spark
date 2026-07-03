// Lightweight inline stroke icons (no external icon dependency).
function Svg({ children, className = "h-4 w-4", ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export const Shield = (p) => (
  <Svg {...p}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /></Svg>
);
export const Activity = (p) => (
  <Svg {...p}><path d="M3 12h4l3 8 4-16 3 8h4" /></Svg>
);
export const Bell = (p) => (
  <Svg {...p}><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></Svg>
);
export const Lock = (p) => (
  <Svg {...p}><rect x="4.5" y="11" width="15" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></Svg>
);
export const Unlock = (p) => (
  <Svg {...p}><rect x="4.5" y="11" width="15" height="9" rx="2" /><path d="M8 11V8a4 4 0 017.5-2" /></Svg>
);
export const Link = (p) => (
  <Svg {...p}><path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1" /><path d="M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1" /></Svg>
);
export const Play = (p) => (
  <Svg {...p}><path d="M7 5l12 7-12 7V5z" /></Svg>
);
export const Stop = (p) => (
  <Svg {...p}><rect x="6" y="6" width="12" height="12" rx="2" /></Svg>
);
export const Logout = (p) => (
  <Svg {...p}><path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></Svg>
);
export const Copy = (p) => (
  <Svg {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></Svg>
);
export const Check = (p) => (
  <Svg {...p}><path d="M4 12l5 5L20 6" /></Svg>
);
export const Users = (p) => (
  <Svg {...p}><path d="M16 20v-1a4 4 0 00-8 0v1" /><circle cx="12" cy="8" r="3.2" /><path d="M22 20v-1a4 4 0 00-3-3.8" /><path d="M2 20v-1a4 4 0 013-3.8" /></Svg>
);
export const Database = (p) => (
  <Svg {...p}><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></Svg>
);
export const Search = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></Svg>
);
export const Warning = (p) => (
  <Svg {...p}><path d="M12 3l9 16H3l9-16z" /><path d="M12 10v4" /><path d="M12 17h.01" /></Svg>
);
