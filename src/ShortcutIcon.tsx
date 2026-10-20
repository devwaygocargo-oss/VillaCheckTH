import type { ReactNode } from "react";
import type { ShortcutIconName } from "./cms";
const drawings: Record<ShortcutIconName, ReactNode> = {
  find: <><path className="shortcut-icon-fill" d="m5 15 10-9 10 9v12H5Z"/><path d="m4 15 11-10 11 10M7 13v13h9M12 26v-8h5"/><circle cx="23" cy="22" r="5"/><path d="m27 26 4 4"/></>,
  scan: <><path d="M11 4H5v6M23 4h6v6M5 23v6h6M29 23v6h-6"/><path className="shortcut-icon-fill" d="M10 10h5v5h-5zM20 10h4v5h-4zM10 20h5v4h-5z"/><path d="M10 10h5v5h-5zM20 10h4v5h-4zM10 20h5v4h-5zM20 20h4v4M20 27h7"/><path className="shortcut-icon-accent" d="M3 17h28"/></>,
  transfer: <><path className="shortcut-icon-fill" d="M7 5h16v23H7Z"/><path d="M12 5V3h7v2M9 5H6v24h10M21 5h4v10M11 11h9M11 16h5"/><path d="m23 18 7 3v4c0 4-7 7-7 7s-7-3-7-7v-4Z"/><path className="shortcut-icon-accent" d="m20 25 2 2 4-5"/></>,
  status: <><circle className="shortcut-icon-fill" cx="17" cy="17" r="11"/><path d="M26 8a13 13 0 1 0 4 13M28 3v7h-7"/><path d="m17 8 8 3v7c0 5-8 9-8 9s-8-4-8-9v-7Z"/><path className="shortcut-icon-accent" d="m13 17 3 3 5-6"/></>,
  owner: <><path className="shortcut-icon-fill" d="m16 4 12 10v14H4V14Z"/><path d="m3 14 13-11 13 11M6 15v13h8M25 15v6M11 28v-9h7"/><circle cx="24" cy="25" r="4"/><path className="shortcut-icon-accent" d="m21 28-5 5m2-2-2-2"/></>,
  contact: <><path className="shortcut-icon-fill" d="M4 5h20v16H12l-6 5v-5H4Z"/><path d="M24 15V7a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3v5l6-5h5"/><path d="M27 12h2a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3v5l-6-5h-4a3 3 0 0 1-3-3v-2"/><path className="shortcut-icon-accent" d="M9 11h9M9 16h5"/></>,
};

export default function ShortcutIcon({name}:{name:ShortcutIconName}) { return <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{drawings[name]}</svg>; }
