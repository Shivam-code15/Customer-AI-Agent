import Link from 'next/link';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { isLoggedIn, user } = useAuth();

  return (
    <div className="homepage">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">Customer Service Portal</h1>
            <p className="hero-subtitle">
              Access your order information and get instant support through our intelligent customer service platform
            </p>

            <div className="cta-section">
              {isLoggedIn ? (
                <>
                  <p>Welcome back!</p>
                  <Link href="/orders" className="cta-button">
                    View Your Orders
                  </Link>
                  <p className="login-hint">
                    Check your order status or chat with MJ, our AI assistant
                  </p>
                </>
              ) : (
                <>
                  <Link href="/login" className="cta-button">
                    Access Your Account
                  </Link>
                  <p className="login-hint">
                    Use your unique customer ID to view order details and chat with our AI assistant, MJ
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📋</div>
              <h3>Order Tracking</h3>
              <p>View detailed information about your sales orders, shipping status, and delivery updates</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>MJ AI Assistant</h3>
              <p>Get instant answers to your questions through our intelligent chatbot support system</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Secure Access</h3>
              <p>Your information is protected with secure login using your unique customer identification</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
