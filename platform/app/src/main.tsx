import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import './i18n';
import './styles/fonts/base.css';
import './styles/tokens.css';
import './styles/components.css';
import './styles/app.css';
import { CONFIG } from './config';
import { queryClient } from './api';
import { App } from './App';
import { installBehaviours } from './ui/behaviours';
import { installTxHandlers } from './ui/tx';
import { installMockWallet } from './wallet/mockWallet';

installBehaviours();
installTxHandlers();

async function boot() {
  let Wrap: (p: { children: React.ReactNode }) => React.ReactNode = ({ children }) => children;
  if (CONFIG.mockWallet) installMockWallet();
  else {
    // Privy loads only when it is used (mock builds never download it)
    const { PrivyRoot } = await import('./wallet/PrivyBridge');
    Wrap = PrivyRoot;
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Wrap><App /></Wrap>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}
void boot();
