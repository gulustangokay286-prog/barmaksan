export type Lang = 'tr' | 'en';
export type Name = { tr: string; en: string | null };

export type FileInfo = {
  id: number;
  cacheKey: string;
  name: string;
  ext: string;
  mime: string;
  kind: 'pdf' | 'image' | 'video' | 'other';
  size: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  pages: number | null;
  thumb: string | null;
  preview: string | null;
  raw: string;
};

export type Version = {
  no: number;
  note: string | null;
  author: string | null;
  createdAt: string;
  file: FileInfo | null;
};

export type DocLanguage = string;
export type ContentLanguage = { code: string; label: string; nativeName: string; direction: 'ltr' | 'rtl' };
export type TechnicalTable = { title: string; columns: string[]; rows: string[][] };
export type ContentStamp = { updatedAt?: string; author?: string | null; changeNote: string };
export type MachineProfile = ContentStamp & { title: string; description: string; features: string[]; specifications: TechnicalTable[]; applications: string[]; productUrl: string };
export type MaintenanceTranslation = ContentStamp & { title: string; description: string; steps: string[]; warning: string; videos: { title: string; url: string }[]; documents: string[] };
export type MaintenanceTopic = { id: string; translations: Record<string, MaintenanceTranslation> };
export type MaintenanceCategory = { id: string; titles: Record<string, string>; topics: MaintenanceTopic[] };
/** Belge kartındaki video bağlantısı: ya bir adres (YouTube vb.) ya da makineye yüklenmiş bir video belgesi. */
export type MachineLink = { id: string; type: string; title: string; url: string | null; document: string | null };
export type MachineContent = { revision: number; profiles: Record<string, MachineProfile>; gallery: string[] | null; maintenance: MaintenanceCategory[]; links?: MachineLink[]; updatedAt: string; author: string | null };

export type Doc = {
  id: string;
  title: Name;
  type: string;
  language: DocLanguage;
  description: string | null;
  tags: string[];
  versionCount: number;
  createdAt: string;
  updatedAt: string;
  folder: { slug: string; kind: FolderKind; name: Name };
  current: Version | null;
  archivedAt?: string | null;
  excerpt?: { text: string; highlights: [number, number][] } | null;
};

/** hiddenVersions: üye olmayana gösterilmeyen eski sürüm sayısı. */
export type DocDetail = Doc & { crumbs: Crumb[]; versions: Version[]; hiddenVersions?: number };

export type FolderKind = 'section' | 'category' | 'machine' | 'collection';
export type Crumb = { slug: string; kind: FolderKind; name: Name };

export type TreeNode = {
  id: number;
  parentId: number | null;
  kind: FolderKind;
  slug: string;
  name: Name;
  modelCode: string | null;
  docCount: number;
  cover: string | null;
};

export type FolderChild = {
  slug: string;
  kind: FolderKind;
  name: Name;
  modelCode: string | null;
  docCount: number;
  childCount: number;
  cover: string | null;
};

export type Folder = {
  content: MachineContent | null;
  slug: string;
  kind: FolderKind;
  name: Name;
  description: { tr: string | null; en: string | null };
  updatedAt: string;
  crumbs: Crumb[];
  machine: null | {
    brand: { slug: string; name: string } | null;
    modelCode: string | null;
    models: string[];
    summary: { tr: string | null; en: string | null };
    cover: FileInfo | null;
  };
  machineCount: number;
  children: FolderChild[];
  documents: Doc[];
};

export type DocType = {
  slug: string;
  name: Name;
  short: string | null;
  icon: string;
  media: 'document' | 'image' | 'video';
  versioned: boolean;
};

export type Stats = { machines: number; documents: number; media: number; versions: number; bytes: number };
export type HomeSlide = { doc: string; src: string; thumb: string | null; width: number | null; height: number | null; caption: Name };
export type HomeSettings = { featured: string[]; slides: HomeSlide[] };
export type Bootstrap = { docTypes: DocType[]; tree: TreeNode[]; stats: Stats; home: HomeSettings; coverageTypes: string[]; languages: ContentLanguage[] };

export type SearchResult = {
  query: string;
  terms: string[];
  folders: (Pick<TreeNode, 'slug' | 'kind' | 'name' | 'modelCode' | 'cover'> & { parent: Name | null })[];
  documents: Doc[];
};

export type MediaPage = { items: Doc[]; next: string | null; total: number };

export type Activity = {
  id: number;
  at: string;
  action: 'document.created' | 'document.updated' | 'document.archived' | 'version.published' | 'folder.created' | 'folder.updated' | string;
  actor: string | null;
  versionNo: number | null;
  detail: Record<string, unknown> | string[] | null;
  document: { id: string; title: Name } | null;
  folder: { slug: string; kind: FolderKind; name: Name } | null;
};
export type Coverage = { slug: string; name: Name; category: { slug: string; name: Name } | null; types: string[] };

/** Yönetim ağacı: açıklama ve makine alanlarıyla. */
export type AdminFolder = {
  id: number;
  parentId: number | null;
  kind: FolderKind;
  slug: string;
  name: Name;
  description: { tr: string | null; en: string | null };
  sort: number;
  updatedAt: string;
  docCount: number;
  childCount: number;
  machine: null | {
    brand: 'barmaksan' | 'ugur' | null;
    modelCode: string | null;
    models: string[];
    summary: { tr: string | null; en: string | null };
    cover: FileInfo | null;
  };
};
export type AdminUser = { id: number; email: string; name: string | null; createdAt: string; lastLogin: string | null };
export type Me = { id: number; email: string; name: string | null } | null;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const EDITOR_KEY = 'bk.editorKey';
export const editorKey = {
  get: () => {
    try {
      return localStorage.getItem(EDITOR_KEY);
    } catch {
      return null;
    }
  },
  set: (k: string | null) => {
    try {
      if (k) localStorage.setItem(EDITOR_KEY, k);
      else localStorage.removeItem(EDITOR_KEY);
    } catch {
      /* özel pencere */
    }
  },
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const key = editorKey.get();
  if (key && init?.method && init.method !== 'GET') headers.set('X-Editor-Key', key);
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      message = (await res.json()).error ?? message;
    } catch {
      /* gövde yok */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

/** Yönetim okumaları: anahtar GET isteklerinde de gönderilir. */
const adminGet = <T,>(path: string) => request<T>(path, { headers: { 'X-Editor-Key': editorKey.get() ?? '' } });

// ── Hesap ───────────────────────────────────────────────────────────────────
export type Account = {
  email: string; role: 'member' | 'admin'; firstName: string | null; lastName: string | null; company: string | null;
  jobTitle: string | null; phone: string | null; country: string | null; profileComplete: boolean; marketing: boolean; google: boolean; hasPassword: boolean;
};
export type Viewer = { kind: 'anonymous' } | { kind: 'guest'; guest: { email: string; name: string | null } } | { kind: 'account'; account: Account };
export type RegisterInput = { email: string; password: string; firstName: string; lastName: string; company?: string; jobTitle?: string; phone?: string; country?: string; kvkk: boolean; marketing?: boolean };
export type ProfileInput = Omit<RegisterInput, 'email' | 'password'>;

export const account = {
  me: () => request<Viewer>('/api/account/me'),
  providers: () => request<{ google: boolean }>('/api/account/providers'),
  login: (email: string, password: string) => request<Viewer>('/api/account/login', { method: 'POST', ...json({ email, password }) }),
  register: (input: RegisterInput) => request<Viewer>('/api/account/register', { method: 'POST', ...json(input) }),
  guest: (input: { email: string; name?: string; company?: string; kvkk: boolean }) => request<Viewer>('/api/account/guest', { method: 'POST', ...json(input) }),
  logout: () => request<Viewer>('/api/account/logout', { method: 'POST' }),
  profile: (input: ProfileInput) => request<Viewer>('/api/account/profile', { method: 'PATCH', ...json(input) }),
  saved: <T,>() => request<T[]>('/api/account/saved'),
  save: (id: string, item: unknown) => request<void>(`/api/account/saved/${encodeURIComponent(id)}`, { method: 'PUT', ...json(item) }),
  unsave: (id: string) => request<void>(`/api/account/saved/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const api = {
  bootstrap: () => request<Bootstrap>('/api/bootstrap'),
  folder: (slug: string) => request<Folder>(`/api/folders/${encodeURIComponent(slug)}`),
  addLanguage: (body: { code: string; label: string; nativeName: string; direction: string }) => request<{ code: string }>('/api/languages', { method: 'POST', ...json(body) }),
  saveMachineContent: (slug: string, content: MachineContent & { note?: string }) => request<MachineContent>(`/api/machines/${encodeURIComponent(slug)}/content`, { method: 'PUT', ...json(content) }),
  saveMachineLinks: (slug: string, revision: number, links: MachineLink[]) => request<MachineContent>(`/api/machines/${encodeURIComponent(slug)}/links`, { method: 'PUT', ...json({ revision, links }) }),
  machineContentHistory: (slug: string) => adminGet<{ revision: number; note: string | null; author: string | null; createdAt: string }[]>(`/api/admin/machines/${encodeURIComponent(slug)}/history`),
  document: (id: string) => request<DocDetail>(`/api/documents/${encodeURIComponent(id)}`),
  recent: (limit = 12, language?: string) => request<Doc[]>(`/api/recent?limit=${limit}${language ? `&language=${encodeURIComponent(language)}` : ''}`),
  media: (params: { folder?: string; kind?: string; cursor?: string | null; language?: string }) => {
    const q = new URLSearchParams();
    if (params.folder) q.set('folder', params.folder);
    if (params.kind) q.set('kind', params.kind);
    if (params.cursor) q.set('cursor', params.cursor);
    if (params.language) q.set('language', params.language);
    return request<MediaPage>(`/api/media?${q}`);
  },
  search: (q: string, type?: string, signal?: AbortSignal, language?: string) =>
    request<SearchResult>(`/api/search?q=${encodeURIComponent(q)}${type ? `&type=${encodeURIComponent(type)}` : ''}${language ? `&language=${encodeURIComponent(language)}` : ''}`, { signal }),

  login: (email: string, password: string) =>
    request<{ token: string; user: { email: string; name: string | null } }>('/api/auth/login', { method: 'POST', ...json({ email, password }) }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  verifyEditor: (key: string) => fetch('/api/editor/verify', { method: 'POST', headers: { 'X-Editor-Key': key } }).then((r) => r.status),
  createDocument: (form: FormData) => request<{ publicId: string }>('/api/documents', { method: 'POST', body: form }),
  addVersion: (id: string, form: FormData) => request<{ publicId: string; versionNo: number }>(`/api/documents/${id}/versions`, { method: 'POST', body: form }),
  restoreVersion: (id: string, versionNo: number, author?: string) =>
    request<{ versionNo: number }>(`/api/documents/${id}/restore`, { method: 'POST', ...json({ versionNo, author }) }),
  updateDocument: (id: string, patch: Record<string, unknown>) => request(`/api/documents/${id}`, { method: 'PATCH', ...json(patch) }),
  archiveDocument: (id: string) => request(`/api/documents/${id}`, { method: 'DELETE' }),
  updateFolder: (slug: string, patch: Record<string, unknown>) => request(`/api/folders/${encodeURIComponent(slug)}`, { method: 'PATCH', ...json(patch) }),

  unarchiveDocument: (id: string) => request(`/api/documents/${id}/unarchive`, { method: 'POST' }),
  deleteDocument: (id: string) => request(`/api/documents/${id}/permanent`, { method: 'DELETE' }),
  deleteVersion: (id: string, no: number) => request<{ deleted: number; current: number | null }>(`/api/documents/${id}/versions/${no}`, { method: 'DELETE' }),
  bulkDocuments: (action: 'archive' | 'unarchive' | 'delete', ids: string[]) =>
    request<{ done: number; failed: { id: string; error: string }[] }>('/api/documents/bulk', { method: 'POST', ...json({ action, ids }) }),
  createFolder: (body: Record<string, unknown>) => request<{ id: number; slug: string }>('/api/folders', { method: 'POST', ...json(body) }),
  reorderFolders: (parent: string | null, slugs: string[]) => request('/api/folders/reorder', { method: 'POST', ...json({ parent, slugs }) }),
  archiveFolder: (slug: string) => request(`/api/folders/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
  uploadCover: (slug: string, form: FormData) => request(`/api/folders/${encodeURIComponent(slug)}/cover`, { method: 'POST', body: form }),
  deleteFolder: (slug: string) => request(`/api/folders/${encodeURIComponent(slug)}/permanent`, { method: 'DELETE', ...json({ confirm: slug }) }),
  createType: (body: Record<string, unknown>) => request<{ slug: string }>('/api/types', { method: 'POST', ...json(body) }),
  updateType: (slug: string, patch: Record<string, unknown>) => request(`/api/types/${slug}`, { method: 'PATCH', ...json(patch) }),
  deleteType: (slug: string) => request(`/api/types/${slug}`, { method: 'DELETE' }),
  reorderTypes: (slugs: string[]) => request('/api/types/reorder', { method: 'POST', ...json({ slugs }) }),
  setCoverageTypes: (types: string[]) => request('/api/settings/coverage', { method: 'PUT', ...json({ types }) }),
  setHome: (body: { featured?: string[]; slides?: { doc: string; tr: string | null; en: string | null }[] }) => request('/api/settings/home', { method: 'PUT', ...json(body) }),
  createUser: (body: { email: string; name: string; password: string }) => request<{ id: number }>('/api/admin/users', { method: 'POST', ...json(body) }),
  updateUser: (id: number, patch: Record<string, unknown>) => request(`/api/admin/users/${id}`, { method: 'PATCH', ...json(patch) }),
  deleteUser: (id: number) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),

  adminDocuments: () => adminGet<Doc[]>('/api/admin/documents'),
  adminDocument: (id: string) => adminGet<DocDetail>(`/api/admin/documents/${encodeURIComponent(id)}`),
  adminTree: () => adminGet<AdminFolder[]>('/api/admin/tree'),
  adminActivity: (limit = 60) => adminGet<Activity[]>(`/api/admin/activity?limit=${limit}`),
  adminCoverage: () => adminGet<Coverage[]>('/api/admin/coverage'),
  adminUsers: () => adminGet<AdminUser[]>('/api/admin/users'),
  me: () => adminGet<Me>('/api/admin/me'),
};

/** Kalıcı bağlantı: her zaman güncel sürümü açar. */
export const permalink = (id: string) => `${window.location.origin}/d/${id}`;
export const versionLink = (id: string, no: number) => `/d/${id}/v/${no}`;
export const downloadLink = (id: string, no?: number) => (no ? `/d/${id}/v/${no}/indir` : `/d/${id}/indir`);
export const pdfPageLink = (file: FileInfo, page = 1) => `/files/${file.id}/page/${page}.webp?v=${file.cacheKey}`;
