import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import './styles/tokens.css';
import './styles/admin.css';
import { CONFIG } from './config';
import { queryClient } from './api/hooks';
import { installBehaviours } from './lib/ui';
import { SimpleAuth } from './auth';
import { App } from './App';

installBehaviours();

async function boot() {
  // statically replaced by Vite: production builds never contain the mock data
  if (import.meta.env.VITE_API_MOCK === '1') await (await import('./mock')).loadMock();
  let Auth: (p: { children: ReactNode }) => ReactNode = SimpleAuth;
  if (!CONFIG.mock && !CONFIG.devAdmin) {
    if (!CONFIG.privyAppId) {
      document.getElementById('root')!.innerHTML = '<div class="auth"><main class="auth-main"><div class="panel"><h1>Cojam admin</h1><p>The admin sign in is not configured: VITE_PRIVY_ADMIN_APP_ID is empty.</p></div></main></div>';
      return;
    }
    // Privy loads only when it is used (mock and dev never download it)
    const [{ PrivyAuth }, privy] = await Promise.all([import('./auth'), import('@privy-io/react-auth')]);
    Auth = ({ children }) => <PrivyAuth privy={privy}>{children}</PrivyAuth>;
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Auth><App /></Auth>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}
void boot();
