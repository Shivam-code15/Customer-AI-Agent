import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';
import { apiRequest } from '../lib/api';
import Footer from '../components/Footer';
import styles from './agent.module.css';

// Utility: link parsing for user messages
function renderMessageWithLinks(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, idx) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.orderSummaryLink}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export default function AgentChatPage({ isPopup, messages, setMessages }) {
  const { isLoggedIn } = useAuth();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const chatWindowRef = useRef(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);

  // Redirect to login if not authenticated
  const router = useRouter();
  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, router]);

  const formatMessagesForBackend = () =>
    messages.map(msg => ({
      role: msg.sender === 'agent' ? 'assistant' : 'user',
      content: msg.text,
    }));

  async function sendMessage() {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    setInput('');
    setMessages(prev => [...prev, { sender: 'user', text: trimmedInput }]);
    setLoading(true);

    try {
      const response = await apiRequest('/agent/', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmedInput,
          previous_messages: formatMessagesForBackend(),
        }),
      });

      const { reply, order_summary } = response;

      setMessages(prev => [
        ...prev,
        {
          sender: 'agent',
          text: reply,
          orderSummary: order_summary || null,
        },
      ]);
    } catch (error) {
      console.error('API Error:', error);
      setMessages(prev => [
        ...prev,
        { sender: 'agent', text: 'Sorry, something went wrong. Please try again later.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!isLoggedIn) return null;

  const containerClass = isPopup ? styles.popupContainer : styles.fullPageContainer;

  return (
    <div className={styles.agentPage}>
      <div className={containerClass}>
        {/* Header */}
        <div className={styles.chatHeader}>
          <div className={styles.headerContent}>
            <div className={styles.agentInfo}>
              <div className={styles.agentAvatar}>🤖</div>
              <div className={styles.agentDetails}>
                <h2 className={styles.agentName}>Oddjob, AI Assistant</h2>
                <span className={styles.agentStatus}>
                  <span className={styles.statusDot}></span>
                  Online
                </span>
              </div>
            </div>
            {!isPopup && (
              <Link href="/orders" className={styles.viewOrdersButton}>
                View Orders
              </Link>
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className={styles.chatWindow} ref={chatWindowRef}>
          {messages.length === 0 && (
            <div className={styles.welcomeMessage}>
              <div className={styles.welcomeIcon}>👋</div>
              <h3>Welcome to Oddjob</h3>
              <p>I'm here to help you with your orders and any questions you might have.</p>
              <div className={styles.suggestedQuestions}>
                <p>Try asking:</p>
                <button 
                  className={styles.suggestedButton}
                  onClick={() => setInput("What's the status of my latest order?")}
                >
                  "What's the status of my latest order?"
                </button>
                <button 
                  className={styles.suggestedButton}
                  onClick={() => setInput("Show me my recent orders")}
                >
                  "Show me my recent orders"
                </button>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`${styles.message} ${
                msg.sender === 'agent' ? styles.agentMessage : styles.userMessage
              }`}
            >
              <div className={styles.messageContent}>
                <div className={styles.messageText}>
                  {msg.sender === 'agent' ? (
                    <ReactMarkdown
                      components={{
                        a: ({ node, ...props }) => (
                          <a {...props} className={styles.messageLink} target="_blank" rel="noopener noreferrer" />
                        ),
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  ) : (
                    renderMessageWithLinks(msg.text)
                  )}
                </div>

                {/* Order Summary Card */}
                {msg.sender === 'agent' && msg.orderSummary && (
                  <div className={styles.orderSummaryCard}>
                    <div className={styles.orderSummaryHeader}>
                      <span className={styles.orderIcon}>📋</span>
                      <strong>Order Summary</strong>
                    </div>
                    <div className={styles.orderSummaryContent}>
                      <div className={styles.orderDetail}>
                        <span className={styles.orderLabel}>Order ID:</span>
                        <span className={styles.orderValue}>{msg.orderSummary.sales_order_number}</span>
                      </div>
                      <div className={styles.orderDetail}>
                        <span className={styles.orderLabel}>Status:</span>
                        <span className={styles.orderValue}>{msg.orderSummary.display_status || 'Processing'}</span>
                      </div>
                      <div className={styles.orderDetail}>
                        <span className={styles.orderLabel}>Order Date:</span>
                        <span className={styles.orderValue}>
                          {msg.orderSummary.order_date
                            ? new Date(msg.orderSummary.order_date + 'T00:00:00').toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </div>
                      <div className={styles.orderDetail}>
                        <span className={styles.orderLabel}>Total:</span>
                        <span className={styles.orderValue}>
                          {msg.orderSummary.order_total !== undefined
                            ? `$${msg.orderSummary.order_total.toFixed(2)}`
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/orders/${msg.orderSummary.sales_order_number}`}
                      className={styles.orderSummaryLink}
                    >
                      View Order Details →
                    </Link>
                  </div>
                )}
              </div>

              <div className={styles.messageTime}>
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}

          {loading && (
            <div className={styles.loadingMessage}>
              <div className={styles.typingIndicator}>
                <div className={styles.agentAvatar}>🤖</div>
                <div className={styles.typingDots}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className={styles.chatInput}>
          <form
            onSubmit={e => {
              e.preventDefault();
              sendMessage();
            }}
            className={styles.form}
          >
            <div className={styles.inputWrapper}>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about your orders..."
                className={styles.inputField}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className={styles.sendButton}
              >
                {loading ? (
                  <span className={styles.sendingText}>...</span>
                ) : (
                  <span className={styles.sendIcon}>→</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {!isPopup && <Footer />}
    </div>
  );
}