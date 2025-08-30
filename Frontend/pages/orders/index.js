import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import Footer from '../../components/Footer';
import styles from './orders.module.css';

export default function OrdersPage() {
  const { isLoggedIn } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const perPage = 10; // orders per page

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, router]);

  async function fetchOrders(currentPage = 1) {
    if (!isLoggedIn) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/orders/?page=${currentPage}&per_page=${perPage}`);
      setOrders(data.orders || []);
      setPage(currentPage);
    } catch (err) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }

  // Initial fetch on page load and when isLoggedIn changes
  useEffect(() => {
    fetchOrders(1);
  }, [isLoggedIn]);

  async function handleSearch(e) {
    e.preventDefault();
    const term = search.trim().toUpperCase();
    if (!term) {
      fetchOrders(1);
      return;
    }
    setLoading(true);
    setError('');
    setIsSearching(true);

    let soSearch = term;
    if (!soSearch.startsWith('SO')) {
      const onlyDigits = /^\d+$/.test(soSearch);
      if (onlyDigits) {
        soSearch = `SO${soSearch}`;
      }
    }

    try {
      const data = await apiRequest(`/orders/?tranid=${encodeURIComponent(soSearch)}&page=1&per_page=${perPage}`);
      setOrders(data.orders || []);
      setPage(1);
    } catch (err) {
      setError(err.message || 'Failed to search orders');
    } finally {
      setLoading(false);
    }
  }

  function getStatusClassName(status) {
    if (!status) return 'status-other';
    const s = status.toLowerCase();
    if (s === 'shipped') return 'status-shipped';
    if (s === 'pending' || s === 'processing') return 'status-pending';
    if (s === 'completed') return 'status-completed';
    if (s === 'partially shipped') return 'status-partial';
    if (s === 'cancelled') return 'status-cancelled';
    return 'status-other';
  }

  function clearSearch() {
    setSearch('');
    fetchOrders(1);
  }

  return (
    <div className={styles.ordersPage}>
      <div className={styles.container}>
        {/* Page Header */}
        <div className={styles.pageHeader}>
          <h1 className={styles.heading}>Your Orders</h1>
          <p className={styles.subtitle}>Track and manage your orders</p>
        </div>

        {/* Search Section */}
        <div className={styles.searchSection}>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <div className={styles.searchInputGroup}>
              <input
                type="text"
                placeholder="Search by SO Number (e.g. SO12345)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
              <button type="submit" className={styles.searchButton} disabled={loading}>
                {loading ? '...' : '🔍 Search'}
              </button>
            </div>
            {isSearching && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={clearSearch}
              >
                Clear Search
              </button>
            )}
          </form>
        </div>

        {/* Content Section */}
        <div className={styles.contentSection}>
          {loading && (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p className={styles.loadingText}>Loading your orders...</p>
            </div>
          )}

          {error && (
            <div className={styles.errorContainer}>
              <span className={styles.errorIcon}>⚠️</span>
              <p className={styles.errorText}>{error}</p>
            </div>
          )}

          {!loading && orders.length === 0 && !error && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📋</div>
              <h3>No Orders Found</h3>
              <p>
                {isSearching 
                  ? "No orders match your search criteria. Try a different SO number." 
                  : "You don't have any orders yet."}
              </p>
              {isSearching && (
                <button onClick={clearSearch} className={styles.emptyButton}>
                  View All Orders
                </button>
              )}
            </div>
          )}

          {orders.length > 0 && (
            <>
              <div className={styles.tableContainer}>
                <table className={styles.ordersTable}>
                  <thead>
                    <tr className={styles.tableHeaderRow}>
                      <th className={styles.tableHeaderCell}>Order Number</th>
                      <th className={styles.tableHeaderCell}>Date</th>
                      <th className={styles.tableHeaderCell}>Status</th>
                      <th className={styles.tableHeaderCell}>Total</th>
                      <th className={styles.tableHeaderCell}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.sales_order_number} className={styles.tableBodyRow}>
                        <td className={styles.tableBodyCell}>
                          <div className={styles.orderNumber}>
                            {order.sales_order_number}
                          </div>
                        </td>
                        <td className={styles.tableBodyCell}>
                          <div className={styles.orderDate}>
                            {order.order_date
                              ? new Date(order.order_date + 'T00:00:00').toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'N/A'}
                          </div>
                        </td>
                        <td className={styles.tableBodyCell}>
                          <span className={`${styles.statusBadge} ${styles[getStatusClassName(order.display_status)]}`}>
                            {order.display_status || 'Processing'}
                          </span>
                        </td>
                        <td className={styles.tableBodyCell}>
                          <div className={styles.orderTotal}>
                            {order.order_total !== undefined
                              ? `$${order.order_total.toFixed(2)}`
                              : 'N/A'}
                          </div>
                        </td>
                        <td className={styles.tableBodyCell}>
                          <Link
                            href={`/orders/${order.sales_order_number}`}
                            className={styles.viewButton}
                          >
                            View Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className={styles.pagination}>
                <button 
                  className={styles.paginationButton}
                  onClick={() => fetchOrders(page - 1)} 
                  disabled={page === 1}
                >
                  ← Previous
                </button>
                <span className={styles.pageInfo}>Page {page}</span>
                <button
                  className={styles.paginationButton}
                  onClick={() => fetchOrders(page + 1)}
                  disabled={orders.length < perPage}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
