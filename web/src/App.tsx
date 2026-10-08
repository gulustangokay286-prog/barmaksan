import { useEffect } from 'react';
import { Outlet, ScrollRestoration, useLocation, useNavigationType } from 'react-router';
import { MotionConfig } from 'motion/react';
import { Shell } from './components/Shell';
import { SearchPalette } from './components/SearchPalette';
import { Lightbox } from './components/Lightbox';
import { EditorKeySheet, UploadSheet } from './components/Editor';
import { useChromeActions, useUi } from './lib/ui';
import { RouteGate } from './lib/route';

/** Kök yerleşim: gezinme anında, belge önizlemelerinde isteğe bağlı görsel geçiş. */
export default function Root() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const { setNavOpen } = useUi();
  const { setTitleVisible } = useChromeActions();

  useEffect(() => {
    setNavOpen(false);
    setTitleVisible(true);
  }, [pathname, setNavOpen, setTitleVisible]);

  return (
    <MotionConfig reducedMotion="user">
      <RouteGate>
      <Shell
        overlays={
          <>
            <SearchPalette />
            <Lightbox />
            <EditorKeySheet />
            <UploadSheet />
          </>
        }
      >
        <div key={pathname} className="page-enter" data-history-return={navigationType === 'POP' || undefined}>
          <Outlet />
        </div>
      </Shell>
      </RouteGate>
      <ScrollRestoration />
    </MotionConfig>
  );
}
