// İkon seti: Lucide (ISC) çizimleri, 24 ızgara, ince çizgi, yuvarlak uçlar. Her ikonun kendi küçük
// animasyonu var (styles/icons.css): bağlantı/düğme üzerine gelince, odaklanınca ya da etkin
// olunca bir kez oynar. Yalnızca transform ve stroke-dashoffset; azaltılmış harekette kapalı.
import { createElement, type SVGProps } from 'react';
import {
  Archive, ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, BadgeCheck, BookMarked, BookOpen, Bookmark, Building2,
  ChartColumn, Check, CirclePlay, ChevronDown, ChevronLeft, ChevronRight, Clock3, Cog, Copy, DraftingCompass, Droplet, Ellipsis,
  Eye, File, FileText, Folder, FolderOpen, Globe, GripVertical, History, House, Image, Images, Info, Keyboard,
  Languages, Layers, LibraryBig, Link2, Lock, LockOpen, LogIn, Mail, Menu, Moon, Palette, PanelLeft, Pause, PenLine,
  Phone, Play, Plus, Printer, ScrollText, Search, Send, Share, Sparkles, Star, Sun, Table2, Trash2, Upload, User,
  Users, Video, Wrench, X, type IconNode,
} from 'lucide';

/** Ad → çizim ve animasyon türü. Eski adlar korunur; çağıranlar değişmez. */
const icons: Record<string, [IconNode, string]> = {
  // Gezinme
  library: [LibraryBig, 'tilt'],
  clock: [Clock3, 'tick'],
  history: [History, 'rewind'],
  images: [Images, 'draw'],
  photo: [Image, 'draw'],
  folder: [Folder, 'tilt'],
  folderOpen: [FolderOpen, 'tilt'],
  search: [Search, 'swing'],
  home: [House, 'hop'],
  bookmark: [Bookmark, 'drop'],
  bookmarkFilled: [Bookmark, 'drop'],
  user: [User, 'hop'],
  users: [Users, 'hop'],
  menu: [Menu, 'pop'],
  sidebar: [PanelLeft, 'pop'],
  // Yön
  chevronRight: [ChevronRight, 'right'],
  chevronLeft: [ChevronLeft, 'left'],
  chevronDown: [ChevronDown, 'down'],
  arrowRight: [ArrowRight, 'right'],
  arrowUp: [ArrowUp, 'up'],
  arrowDown: [ArrowDown, 'down'],
  external: [ArrowUpRight, 'out'],
  // Eylemler
  close: [X, 'turn'],
  plus: [Plus, 'turn'],
  check: [Check, 'draw'],
  download: [Download(), 'drop'],
  upload: [Upload, 'up'],
  share: [Share, 'up'],
  send: [Send, 'out'],
  link: [Link2, 'swing'],
  copy: [Copy, 'pop'],
  print: [Printer, 'hop'],
  trash: [Trash2, 'swing'],
  archive: [Archive, 'hop'],
  pencil: [PenLine, 'swing'],
  more: [Ellipsis, 'pop'],
  grip: [GripVertical, 'pop'],
  login: [LogIn, 'right'],
  mail: [Mail, 'pop'],
  phone: [Phone, 'swing'],
  // Durum ve ayarlar
  play: [Play, 'pop'],
  pause: [Pause, 'pop'],
  info: [Info, 'pop'],
  lock: [Lock, 'hop'],
  unlock: [LockOpen, 'hop'],
  eye: [Eye, 'blink'],
  sun: [Sun, 'spin'],
  moon: [Moon, 'swing'],
  globe: [Globe, 'spin'],
  translate: [Languages, 'pop'],
  palette: [Palette, 'swing'],
  keyboard: [Keyboard, 'pop'],
  star: [Star, 'spin'],
  sparkles: [Sparkles, 'pop'],
  layers: [Layers, 'hop'],
  chart: [ChartColumn, 'draw'],
  // Doküman türleri
  table: [Table2, 'draw'],
  sheet: [FileText, 'draw'],
  letterhead: [ScrollText, 'draw'],
  drawing: [DraftingCompass, 'swing'],
  parts: [Cog, 'spin'],
  book: [BookOpen, 'tilt'],
  catalog: [BookMarked, 'tilt'],
  wrench: [Wrench, 'swing'],
  drop: [Droplet, 'hop'],
  seal: [BadgeCheck, 'spin'],
  building: [Building2, 'hop'],
  video: [Video, 'right'],
  youtube: [YouTube(), 'pop'],
  watch: [CirclePlay, 'pop'],
  file: [File, 'draw'],
};

/** YouTube: yuvarlatılmış ekran + oynat üçgeni (Lucide'in eski youtube çizimi, ISC). */
function YouTube(): IconNode {
  return [
    ['path', { d: 'M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17' }],
    ['path', { d: 'm10 15 5-3-5-3z', fill: 'currentColor' }],
  ];
}

/** Lucide'in indirme çizimi okun başta olduğu sırayla: animasyon oku tepsiden ayırır. */
function Download(): IconNode {
  return [['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }], ['path', { d: 'M12 15V3' }], ['path', { d: 'm7 10 5 5 5-5' }]];
}

export type IconName = keyof typeof icons | string;

export function Icon({ name, size = 20, strokeWidth = 1.5, className, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  const [node, anim] = icons[name] ?? icons.file;
  const filled = name === 'bookmarkFilled';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      // 20 ızgaralı eski kalınlıklar 24 ızgaraya taşınır; biraz daha ince ve zarif kalır.
      strokeWidth={strokeWidth * 1.08}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ? `ai ${className}` : 'ai'}
      data-anim={anim}
      {...rest}
    >
      {node.map(([tag, attrs], i) => createElement(tag, { ...attrs, key: i, pathLength: 1, 'data-i': i }))}
    </svg>
  );
}
