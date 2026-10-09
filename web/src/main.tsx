import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { QueryClientProvider } from '@tanstack/react-query';
import Root from './App';
import Home from './pages/Home';
import Folder from './pages/Folder';
import Machine from './pages/Machine';
import DocumentPage from './pages/Document';
import Media from './pages/Media';
import Recent from './pages/Recent';
import Saved from './pages/Saved';
import NotFound from './pages/NotFound';
import AdminRoot from './admin/AdminRoot';
import AdminOverview from './admin/Overview';
import AdminDocuments from './admin/Documents';
import AdminCoverage from './admin/Coverage';
import AdminActivity from './admin/Activity';
import AdminFolders from './admin/Folders';
import AdminMachines from './admin/Machines';
import AdminHome from './admin/Home';
import AdminTypes from './admin/Types';
import AdminAccount from './admin/Account';
import AdminLanguages from './admin/Languages';
import { I18nProvider } from './lib/i18n';
import { ChromeProvider, UiProvider } from './lib/ui';
import { docQuery, folderQuery, queryClient, recentQuery, warm } from './lib/query';
import { SplashGate, warmUp } from './lib/splash';
import './styles/tokens.css';
import './styles/base.css';
import './styles/grid.css';
import './styles/motion.css';

// Veri ve ilk görsel, React çizilmeden istenir; perde gerçek ilerlemeyi gösterir.
void warmUp();

// Yükleyiciler hiçbir zaman beklemez: sayfa anında açılır, veri varsa gösterir, yoksa iskelet çizer.
const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { index: true, element: <Home />, loader: () => warm(recentQuery(6)) },
      { path: 'son', element: <Recent />, loader: () => warm(recentQuery(50)) },
      { path: 'medya', element: <Media /> },
      { path: 'kaydedilenler', element: <Saved /> },
      { path: 'kurumsal-kimlik', element: <Navigate to="/k/kurumsal-kimlik" replace /> },
      { path: 'k/:slug', element: <Folder />, loader: ({ params }) => warm(folderQuery(params.slug!)) },
      { path: 'm/:slug', element: <Machine />, loader: ({ params }) => warm(folderQuery(params.slug!)) },
      { path: 'dokuman/:id', element: <DocumentPage />, loader: ({ params }) => warm(docQuery(params.id!)) },
      { path: '*', element: <NotFound /> },
    ],
  },
  // Yönetim paneli: sitenin kabuğundan ayrı, /admin ile.
  {
    path: 'admin',
    element: <AdminRoot />,
    children: [
      { index: true, element: <AdminOverview /> },
      { path: 'belgeler', element: <AdminDocuments /> },
      { path: 'eksikler', element: <AdminCoverage /> },
      { path: 'klasorler', element: <AdminFolders /> },
      { path: 'hareketler', element: <AdminActivity /> },
      { path: 'makineler', element: <AdminMachines /> },
      { path: 'ana-sayfa', element: <AdminHome /> },
      { path: 'turler', element: <AdminTypes /> },
      { path: 'hesap', element: <AdminAccount /> },
      { path: 'diller', element: <AdminLanguages /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <UiProvider>
          <ChromeProvider>
            <SplashGate>
              <RouterProvider router={router} />
            </SplashGate>
          </ChromeProvider>
        </UiProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
);
