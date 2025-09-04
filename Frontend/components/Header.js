import Link from 'next/link';
import Image from 'next/image';
import styles from './Header.module.css';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';

export default function Header() {
  const { isLoggedIn, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      router.push('/login');
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <Link href="/" className={styles.logoLink}>
          <Image
            src="/Stage of Art-Logo.png"
            alt="Stage of Art"
            width={160}
            height={60}
            priority
            className={styles.logoImage}
          />
        </Link>
      </div>

      <div className={styles.tagline}>
        <Image
          src="/Tagline.png"
          alt="Every Artist Has A Stage"
          width={180}
          height={60}
          className={styles.taglineImage}
        />
      </div>

      {isLoggedIn && (
        <button onClick={handleLogout} className={styles.logoutButton}>
          Logout
        </button>
      )}
    </header>
  );
}
