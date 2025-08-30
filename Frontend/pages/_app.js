// pages/_app.js
import '../styles/globals.css';
import '../pages/index.css'
import { AuthProvider, useAuth } from '../context/AuthContext';
import dynamic from 'next/dynamic';
import Header from '../components/Header'; // Import your new Header

// Dynamically import AgentChatPopup with SSR disabled
const AgentChatPopup = dynamic(() => import('../components/AgentChatPopup'), {
  ssr: false,
});

// Only show chat popup if logged in
function ChatPopupGuard() {
  const { token } = useAuth();
  return token ? <AgentChatPopup /> : null;
}

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      {/* Global Header - appears on every page */}
      <Header />

      {/* The main page content */}
      <Component {...pageProps} />

      {/* Conditional chat popup */}
      <ChatPopupGuard />
    </AuthProvider>
  );
}
