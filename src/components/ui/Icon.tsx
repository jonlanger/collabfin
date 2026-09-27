const PATHS = {
  cursor: "M5.5 3.5l13 6.2-5.6 1.9-2 5.9z",
  hand: "M8 12.5V6a1.5 1.5 0 013 0v5M11 10.5V4.5a1.5 1.5 0 013 0v6M14 10.5V6a1.5 1.5 0 013 0v7.5a6.5 6.5 0 01-6.5 6.5h-.6a6 6 0 01-4.9-2.6l-2.6-3.8a1.5 1.5 0 012.5-1.7L8 14",
  income: "M12 3.5v12M6.5 10L12 15.5 17.5 10M4.5 20h15",
  account: "M3.5 9.5L12 4l8.5 5.5M5.5 10.5v6.5M10 10.5v6.5M14 10.5v6.5M18.5 10.5v6.5M3.5 19.5h17",
  recurring: "M17 3.5l3 3-3 3M4 11.5v-1a4 4 0 014-4h12M7 20.5l-3-3 3-3M20 12.5v1a4 4 0 01-4 4H4",
  spend: "M3.5 4.5h2l2.2 10.5h10.3l2-7.5H6.6M9.5 19.5h.01M17 19.5h.01",
  split: "M4 12h5l5-6.5h6M9 12l5 6.5h6M17 2.5l3 3-3 3M17 15.5l3 3-3 3",
  goal: "M5.5 20.5v-16M5.5 4.5h12l-2.5 4 2.5 4h-12",
  debt: "M3.5 6.5h17v11h-17zM3.5 10.5h17M7 14.5h3",
  tax: "M6 3.5h12v17l-2.5-1.5-2 1.5-1.5-1.5-1.5 1.5-2-1.5L6 20.5zM9 8h6M9 11.5h6M9 15h3",
  note: "M5 4.5h14v9.5l-5.5 5.5H5zM13.5 19.5v-5.5h5.5",
  file: "M13.5 3.5H6.5v17h11v-13zM13.5 3.5v4h4",
  upload: "M12 15.5V4M6.5 9.5L12 4l5.5 5.5M4.5 19.5h15",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  fit: "M4.5 9V4.5H9M19.5 9V4.5H15M4.5 15v4.5H9M19.5 15v4.5H15",
  x: "M6.5 6.5l11 11M17.5 6.5l-11 11",
  trash: "M4.5 6.5h15M9.5 6.5v-2h5v2M6.5 6.5l1 13h9l1-13",
  copy: "M8.5 8.5h11v11h-11zM15.5 8.5v-4h-11v11h4",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  up: "M12 19V5M5.5 11.5L12 5l6.5 6.5",
  down: "M12 5v14M18.5 12.5L12 19l-6.5-6.5",
  alert: "M12 4l9 16H3zM12 10v4M12 17h.01",
  info: "M12 20.5a8.5 8.5 0 100-17 8.5 8.5 0 000 17zM12 11v5M12 8h.01",
  shield: "M12 3.5l7 3v5c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9v-5zM9 12l2 2 4-4",
  grid: "M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z",
  sliders: "M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5",
  arrange: "M4.5 5.5h5v5h-5zM14.5 13.5h5v5h-5zM9.5 8h3a2 2 0 012 2v6",
  zap: "M13 3L5 13.5h6L10 21l8-10.5h-6z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z",
  eye: "M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  undo: "M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11",
  redo: "M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 000 11H13",
  clock: "M12 20.5a8.5 8.5 0 100-17 8.5 8.5 0 000 17zM12 7.5V12l3 2",
  layers: "M12 3.5l8.5 4.5-8.5 4.5L3.5 8zM3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5",
  compare: "M4.5 4.5h15v15h-15zM9.5 4.5v15M14.5 4.5v15",
  chevron: "M6.5 9.5L12 15l5.5-5.5",
  importIcon: "M4.5 4.5h10l5 5v10h-15zM14.5 4.5v5h5M8.5 14l2.5 2.5 4.5-5",
  lock: "M6.5 10.5h11v9h-11zM8.5 10.5V8a3.5 3.5 0 017 0v2.5",
  pencil: "M4.5 19.5l1-4 10-10 3 3-10 10zM13.5 7.5l3 3",
  search: "M11 18.5a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM16.5 16.5l4 4",
  arrowRight: "M5 12h14M13 5.5l6.5 6.5-6.5 6.5",
  menu: "M4 7h16M4 12h16M4 17h16",
  keyboard: "M3.5 6.5h17v11h-17zM7 10h.01M11 10h.01M15 10h.01M8 14h8",
  home: "M4 11l8-6.5 8 6.5M6 9.5v10h12v-10",
  panelOpen: "M4.5 4.5h15v15h-15zM9.5 4.5v15M13 10l2 2-2 2",
  panelClose: "M4.5 4.5h15v15h-15zM9.5 4.5v15M15.5 10l-2 2 2 2",
  share: "M12 15V3.5M7.5 8L12 3.5 16.5 8M5.5 12.5v7h13v-7",
  logout: "M9.5 20.5h-5v-17h5M15 16.5l4.5-4.5L15 7.5M19.5 12H9",
  users: "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 4.3a3.5 3.5 0 010 6.4M18 14.3a6.5 6.5 0 013.5 5.7",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ n, s = 20, w = 1.75 }: { n: IconName; s?: number; w?: number }) {
  return (
    <svg className="ico" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[n] ?? PATHS.file} />
    </svg>
  );
}

export const CURSOR_PATH = PATHS.cursor;
