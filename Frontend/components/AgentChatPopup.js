import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AgentChatPage from '../pages/agent';
import { useRouter } from 'next/router';

export default function AgentChatPopup() {
  const auth = useAuth();
  const router = useRouter();
  
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isClient, setIsClient] = useState(false);
  const [showTag, setShowTag] = useState(true);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const timer = setTimeout(() => setShowTag(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open && messages.length > 1) {
      setHasNewMessage(true);
      const timer = setTimeout(() => setHasNewMessage(false), 5000);
      return () => clearTimeout(timer);
    } else if (open) {
      setHasNewMessage(false);
    }
  }, [messages.length, open]);

  if (!isClient) return null;

  const userLoggedIn = auth?.isLoggedIn || auth?.token || auth?.user;
  if (!userLoggedIn) return null;
  if (router.pathname === '/login' || router.pathname === '/') return null;

  const toggleChat = () => {
    setOpen(prev => !prev);
    if (!open) {
      setShowTag(false);
      setHasNewMessage(false);
    }
  };

  return (
    <>
      {showTag && !open && (
        <div style={{
          position: 'fixed', bottom: '100px', right: '24px',
          background: 'linear-gradient(135deg, #004C54 0%, #A5ACAF 100%)',
          color: 'white', padding: '12px 16px', borderRadius: '24px',
          fontSize: '14px', fontWeight: '500', zIndex: 10002,
          boxShadow: '0 8px 25px rgba(0, 76, 84, 0.3)',
          display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '280px'
        }}>
          <span>🤖</span>
          <span>Need help? Chat with MJ!</span>
          <button onClick={() => setShowTag(false)} style={{
            background: 'none', border: 'none', color: 'white',
            cursor: 'pointer', fontSize: '18px', padding: '0 4px'
          }}>×</button>
        </div>
      )}

      <button onClick={toggleChat} style={{
        position: 'fixed', bottom: '24px', right: '24px',
        background: hasNewMessage 
          ? 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)'
          : 'linear-gradient(135deg, #004C54 0%, #A5ACAF 100%)',
        color: 'white', border: 'none', borderRadius: '50%',
        width: '60px', height: '60px', cursor: 'pointer', zIndex: 10001,
        fontSize: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {open ? '×' : '💬'}
        {hasNewMessage && !open && (
          <div style={{
            position: 'absolute', top: '-2px', right: '-2px',
            width: '12px', height: '12px', background: '#ff4444',
            borderRadius: '50%', border: '2px solid white'
          }} />
        )}
      </button>

      {open && (
        <>
          <div onClick={toggleChat} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)', zIndex: 9999
          }} />
          <div style={{
            position: 'fixed', bottom: '100px', right: '24px',
            width: '420px', height: '600px', background: 'white',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            borderRadius: '16px', zIndex: 10000, overflow: 'hidden'
          }}>
            <AgentChatPage isPopup={true} messages={messages} setMessages={setMessages} />
          </div>
        </>
      )}
    </>
  );
}
