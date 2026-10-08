import { useEffect, useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import s from './CollapsibleFolder.module.css';

export function CollapsibleFolder({ title, count, children, defaultOpen = false, id }: {
  title: string; count?: number; children: ReactNode; defaultOpen?: boolean; id?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen]);
  return (
    <section id={id} className={s.folder} data-state={open ? 'open' : 'closed'}>
      <button className={s.toggle} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((v) => !v)}>
        <Icon name={open ? 'folderOpen' : 'folder'} size={20} />
        <span className={s.title}>{title}</span>
        {count != null && <span className={s.count}>{count}</span>}
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} />
      </button>
      <div id={bodyId} className={s.body} hidden={!open}>{open && children}</div>
    </section>
  );
}
