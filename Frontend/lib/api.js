/**
 * Helper to make authenticated API requests using HttpOnly cookies.
 * Automatically handles authentication redirects and provides detailed error information.
 * 
 * @param {string} endpoint - API endpoint path (e.g. '/orders')
 * @param {object} options - fetch() options (method, headers, body, etc.)
 * @returns {Promise<object>} Parsed JSON response
 */
export async function apiRequest(endpoint, options = {}) {
  // Default headers - only add Content-Type for non-GET requests
  const defaultHeaders = {
    ...(options.method && options.method.toUpperCase() !== 'GET' 
        ? { 'Content-Type': 'application/json' } 
        : {}),
  };
  
  // Merge headers, allowing overrides
  const headers = {
    ...defaultHeaders,
    ...options.headers,
  };

  // Build fetch config with credentials
  const fetchOptions = {
    ...options,
    headers,
    credentials: 'include', // Send HttpOnly cookies
  };

  // Timeout helper
  const fetchWithTimeout = (url, options, timeout = 10000) => {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      ),
    ]);
  };

  const url = `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`;

  let res;
  try {
    res = await fetchWithTimeout(url, fetchOptions);
  } catch (networkError) {
    throw new Error(`Network error: ${networkError.message}`);
  }

  // Handle authentication failure
  if (res.status === 401) {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    
    // Don't redirect if already on login page or if this is an auth check
    const isOnLoginPage = currentPath === '/login';
    const isAuthCheck = endpoint === '/me' || endpoint === '/validate';
    
    if (!isOnLoginPage && !isAuthCheck) {
      // Handle session expiry - redirect to login
      const redirectUrl = `/login${currentPath !== '/' ? `?redirect=${encodeURIComponent(currentPath)}` : ''}`;
      
      if (typeof window !== 'undefined') {
        window.location.href = redirectUrl;
      }
    }
    
    const error = new Error('Session expired. Please login again.');
    error.status = 401;
    throw error;
  }

  // Handle other HTTP errors
  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    let errorDetails = null;
    
    try {
      const errorData = await res.json();
      errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
      errorDetails = errorData;
    } catch {
      // If error response isn't JSON, use status text
      errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    }
    
    const error = new Error(errorMessage);
    error.status = res.status;
    error.details = errorDetails;
    throw error;
  }

  // Parse successful response
  try {
    return await res.json();
  } catch (jsonError) {
    throw new Error('Invalid JSON response from server');
  }
}

/**
 * Helper to check if user is authenticated without making a full API request.
 * Useful for conditional rendering or route protection.
 * 
 * @returns {Promise<{authenticated: boolean, customer_id?: string}>}
 */
export async function checkAuthStatus() {
  try {
    const response = await apiRequest('/validate');
    return {
      authenticated: true,
      customer_id: response.customer_id
    };
  } catch (error) {
    return {
      authenticated: false,
      error: error.message
    };
  }
}

/**
 * Helper to logout user by calling the logout endpoint.
 * 
 * @returns {Promise<boolean>} Success status
 */
export async function logoutUser() {
  try {
    await apiRequest('/logout', { method: 'POST' });
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    return false;
  }
}