'use client'

import { Provider } from 'react-redux'
import { store } from '@/lib/redux/store'
import { ThemeProvider } from 'next-themes'
import { ChatProvider } from '@/contexts/ChatContext'
import { ChatDialogProvider } from '@/contexts/ChatDialogContext';
import { ConfirmProvider } from '@/hooks/use-confirm';
import { UserStatusProvider } from '@/contexts/UserStatusContext';

export function Providers({ children }) {
  return (
    <Provider store={store}>
      <ThemeProvider attribute="class">
        <UserStatusProvider>
          <ChatProvider>
            <ChatDialogProvider>
              <ConfirmProvider>
                {children}
              </ConfirmProvider>
            </ChatDialogProvider>
          </ChatProvider>
        </UserStatusProvider>
      </ThemeProvider>
    </Provider>
  )
}
