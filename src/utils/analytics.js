// Analytics and user tracking utilities
class Analytics {
  constructor() {
    this.isInitialized = false;
    this.userId = null;
    this.sessionId = this.generateSessionId();
  }

  generateSessionId() {
    return 'session_' + Math.random().toString(36).substr(2, 9);
  }

  generateUserId() {
    let userId = localStorage.getItem('tsogo_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('tsogo_user_id', userId);
    }
    return userId;
  }

  init() {
    if (this.isInitialized || !this.hasAnalyticsConsent()) return;
    
    this.userId = this.generateUserId();
    this.isInitialized = true;
    
    this.trackEvent('session_start', {
      session_id: this.sessionId,
      user_id: this.userId,
      timestamp: new Date().toISOString()
    });
    
    console.log('Analytics initialized for user:', this.userId);
  }

  trackEvent(eventName, properties = {}) {
    if (!this.hasAnalyticsConsent()) {
      this.isInitialized = false;
      this.userId = null;
      return;
    }
    if (!this.isInitialized) this.init();

    const eventData = {
      event: eventName,
      user_id: this.userId,
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      ...properties
    };

    // Send to your analytics service (replace with your endpoint)
    this.sendToAnalyticsService(eventData);
    
    // Log for development
    if (import.meta.env.DEV) {
      console.log('Analytics Event:', eventName, eventData);
    }
  }

  hasAnalyticsConsent() {
    try {
      return JSON.parse(localStorage.getItem('tsogo_cookie_consent') || 'null')?.analytics === true;
    } catch {
      return false;
    }
  }

  sendToAnalyticsService(data) {
    // Replace with your actual analytics service endpoint
    // Example: fetch('/api/analytics', { method: 'POST', body: JSON.stringify(data) })
    
    // For now, we'll store in localStorage for demo purposes
    const analyticsData = JSON.parse(localStorage.getItem('tsogo_analytics') || '[]');
    analyticsData.push(data);
    localStorage.setItem('tsogo_analytics', JSON.stringify(analyticsData.slice(-1000))); // Keep last 1000 events
  }

  trackPageView(page) {
    this.trackEvent('page_view', {
      page: page || window.location.pathname,
      title: document.title
    });
  }

  trackProductView(productId, productName) {
    this.trackEvent('product_view', {
      product_id: productId,
      product_name: productName
    });
  }

  trackAddToCart(productId, productName, quantity = 1) {
    this.trackEvent('add_to_cart', {
      product_id: productId,
      product_name: productName,
      quantity: quantity
    });
  }

  trackPurchase(orderId, amount, currency, items = []) {
    this.trackEvent('purchase', {
      order_id: orderId,
      amount: amount,
      currency: currency,
      items: items
    });
  }

  trackSearch(query, resultsCount = 0) {
    this.trackEvent('search', {
      query: query,
      results_count: resultsCount
    });
  }

  trackCategoryView(categoryId, categoryName) {
    this.trackEvent('category_view', {
      category_id: categoryId,
      category_name: categoryName
    });
  }

  getUserStats() {
    const events = JSON.parse(localStorage.getItem('tsogo_analytics') || '[]');
    const userEvents = events.filter(event => event.user_id === this.userId);
    
    return {
      totalEvents: userEvents.length,
      sessionCount: new Set(userEvents.map(e => e.session_id)).size,
      lastActivity: userEvents[userEvents.length - 1]?.timestamp,
      favoriteCategories: this.getFavoriteCategories(userEvents),
      cartAdds: userEvents.filter(e => e.event === 'add_to_cart').length
    };
  }

  getFavoriteCategories(events) {
    const categoryViews = events.filter(e => e.event === 'category_view');
    const categoryCounts = categoryViews.reduce((acc, event) => {
      const category = event.category_name;
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    
    return Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category]) => category);
  }
}

// Create singleton instance
const analytics = new Analytics();

export default analytics;
