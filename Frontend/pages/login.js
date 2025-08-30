import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Footer from '../components/Footer';
import styles from './login.module.css';

export default function LoginPage() {
  const [customerId, setCustomerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, isLoggedIn, user } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn && !loading) {
      console.log('Already logged in, redirecting...');
      const redirectTo = router.query.redirect;
      if (redirectTo && redirectTo !== '/login' && redirectTo !== router.asPath) {
        router.replace(redirectTo);
      } else {
        router.replace('/orders');
      }
    }
  }, [isLoggedIn, user, loading, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const trimmedCustomerId = customerId.trim();

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          username: trimmedCustomerId,
          password: '',
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Invalid customer ID');
      }

      const data = await res.json();
      
      // Wait for login to complete
      await login(data.customer_id);
      
      // Use router.replace instead of router.push to avoid back button issues
      const redirectTo = router.query.redirect;
      if (redirectTo && redirectTo !== '/login') {
        router.replace(redirectTo);
      } else {
        router.replace('/orders');
      }

    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.container}>
        <div className={styles.loginHeader}>
          <h1 className={styles.heading}>Welcome Back</h1>
          <p className={styles.subheading}>
            Enter your customer ID to access your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.loginForm}>
          <div className={styles.inputGroup}>
            <label htmlFor="customerId" className={styles.formLabel}>
              Customer ID
            </label>
            <input
              id="customerId"
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              disabled={loading}
              className={styles.inputField}
              placeholder="Enter your unique customer ID"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || !customerId.trim()}
            className={styles.submitButton}
          >
            {loading ? (
              <span className={styles.loadingText}>
                <span className={styles.spinner}></span>
                Logging in...
              </span>
            ) : (
              'Access Account'
            )}
          </button>
        </form>

        {error && (
          <div className={styles.errorMessage}>
            <span className={styles.errorIcon}>⚠️</span>
            {error}
          </div>
        )}

        <div className={styles.loginFooter}>
          <div className={styles.backLink}>
            <Link href="/" className={styles.homeLink}>
              ← Back to Home
            </Link>
          </div>

          <div className={styles.helpText}>
            <p>Need help? Contact your account representative for your customer ID.</p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}