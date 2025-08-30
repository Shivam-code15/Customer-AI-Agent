import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';
import Link from 'next/link';
import Footer from '../../components/Footer';
import styles from './orderDetail.module.css';

export default function OrderDetailPage() {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const { orderId } = router.query;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect to login if not logged in
  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, router]);

  // Fetch order details when logged in and orderId are available
  useEffect(() => {
    async function fetchOrderDetail() {
      if (!isLoggedIn || !orderId) return;

      setLoading(true);
      setError('');
      try {
        const data = await apiRequest(`/orders/${orderId}`);
        setOrder(data);
      } catch (err) {
        setError(err.message || 'Failed to fetch order details');
      } finally {
        setLoading(false);
      }
    }
    fetchOrderDetail();
  }, [isLoggedIn, orderId]);

  const formatDate = (dateStr) =>
    dateStr
      ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'N/A';

  const getStatusClassName = (status) => {
    if (!status) return 'statusOther';
    const s = status.toLowerCase();
    if (s === 'shipped') return 'statusShipped';
    if (s === 'pending' || s === 'processing') return 'statusPending';
    if (s === 'completed') return 'statusCompleted';
    if (s === 'partially shipped') return 'statusPartial';
    if (s === 'cancelled') return 'statusCancelled';
    return 'statusOther';
  };

  // Prevent UI flicker by not rendering if not logged in
  if (!isLoggedIn) return null;

  return (
    <div className={styles.orderDetailPage}>
      <div className={styles.container}>
        {/* Navigation */}
        <div className={styles.navigation}>
          <Link href="/orders" className={styles.backLink}>
            ← Back to Orders
          </Link>
        </div>

        {/* Page Header */}
        <div className={styles.pageHeader}>
          <h1 className={styles.heading}>Order Details</h1>
          {orderId && (
            <div className={styles.orderIdBadge}>
              Order #{orderId}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p className={styles.loadingText}>Loading order details...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className={styles.errorContainer}>
            <span className={styles.errorIcon}>⚠️</span>
            <p className={styles.errorText}>{error}</p>
          </div>
        )}

        {/* Order Details */}
        {!loading && !error && order && (
          <div className={styles.contentWrapper}>
            {/* Order Summary Card */}
            <div className={styles.summaryCard}>
              <h2 className={styles.cardTitle}>Order Summary</h2>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Customer</span>
                  <span className={styles.summaryValue}>
                    {order.customer_name || 'N/A'}
                    <span className={styles.customerId}>
                      (ID: {order.customer_id || 'N/A'})
                    </span>
                  </span>
                </div>
                
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Order Date</span>
                  <span className={styles.summaryValue}>{formatDate(order.order_date)}</span>
                </div>

                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Requested Ship Date</span>
                  <span className={styles.summaryValue}>{formatDate(order.requested_ship_date)}</span>
                </div>

                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Status</span>
                  <span className={`${styles.statusBadge} ${styles[getStatusClassName(order.display_status)]}`}>
                    {order.display_status || 'Processing'}
                  </span>
                </div>

                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Order Total</span>
                  <span className={styles.summaryValue}>
                    {order.order_total !== undefined ? `$${order.order_total.toFixed(2)}` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Items Section */}
            <div className={styles.itemsCard}>
              <h2 className={styles.cardTitle}>
                Order Items
                {order.items && (
                  <span className={styles.itemCount}>
                    ({order.items.length} item{order.items.length !== 1 ? 's' : ''})
                  </span>
                )}
              </h2>

              {order.items && order.items.length > 0 ? (
                <div className={styles.tableContainer}>
                  <table className={styles.itemsTable}>
                    <thead>
                      <tr className={styles.tableHeaderRow}>
                        <th className={styles.tableHeaderCell}>Item Number</th>
                        <th className={styles.tableHeaderCell}>Description</th>
                        <th className={styles.tableHeaderCell}>Unit</th>
                        <th className={styles.tableHeaderCell}>Quantity</th>
                        <th className={styles.tableHeaderCell}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, idx) => (
                        <tr key={idx} className={styles.tableBodyRow}>
                          <td className={styles.tableBodyCell}>
                            <div className={styles.itemNumber}>{item.item_number}</div>
                          </td>
                          <td className={styles.tableBodyCell}>
                            <div className={styles.itemDescription}>
                              {item.item_description || 'N/A'}
                            </div>
                          </td>
                          <td className={styles.tableBodyCell}>
                            <div className={styles.itemUnit}>{item.item_unit || 'N/A'}</div>
                          </td>
                          <td className={styles.tableBodyCell}>
                            <div className={styles.itemQuantity}>{item.line_quantity}</div>
                          </td>
                          <td className={styles.tableBodyCell}>
                            <div className={styles.itemPrice}>
                              ${item.line_net_amount.toFixed(2)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.emptyItems}>
                  <div className={styles.emptyIcon}>📦</div>
                  <p>No items found for this order.</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className={styles.actionButtons}>
              <Link href="/orders" className={styles.primaryButton}>
                Back to All Orders
              </Link>
              <button
                className={styles.secondaryButton}
                onClick={() => window.print()}
              >
                Print Order
              </button>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
