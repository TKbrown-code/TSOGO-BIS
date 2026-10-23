import React, { useState, useEffect } from 'react';

/**
 * RateLimitMonitor - Development tool to monitor rate limiting
 * Shows current rate limit status for different actions
 * 
 * ⚠️ Only display in development mode
 */
export default function RateLimitMonitor() {
  const [rateLimits, setRateLimits] = useState({});
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development
  if (import.meta.env.MODE !== 'development') {
    return null;
  }

  useEffect(() => {
    const updateRateLimits = () => {
      const limits = {};
      const now = Date.now();

      // Check all rate limit keys in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('rateLimit_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            const actionName = key.replace('rateLimit_', '');
            
            // Remove old attempts outside the window (60 seconds)
            const recentAttempts = data.attempts.filter(time => now - time < 60000);
            
            limits[actionName] = {
              attempts: recentAttempts.length,
              maxAttempts: 10, // Default max
              blocked: data.blocked && data.blockedUntil > now,
              blockedUntil: data.blockedUntil,
              timeRemaining: data.blockedUntil > now ? Math.ceil((data.blockedUntil - now) / 1000) : 0,
            };
          } catch (error) {
            console.error('Error parsing rate limit data:', error);
          }
        }
      }

      setRateLimits(limits);
    };

    // Update every second
    const interval = setInterval(updateRateLimits, 1000);
    updateRateLimits(); // Initial update

    return () => clearInterval(interval);
  }, []);

  const clearRateLimit = (actionName) => {
    localStorage.removeItem(`rateLimit_${actionName}`);
    setRateLimits(prev => {
      const updated = { ...prev };
      delete updated[actionName];
      return updated;
    });
  };

  const clearAllRateLimits = () => {
    Object.keys(rateLimits).forEach(actionName => {
      localStorage.removeItem(`rateLimit_${actionName}`);
    });
    setRateLimits({});
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '10px 15px',
          backgroundColor: '#333',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          zIndex: 9999,
          fontSize: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
        }}
      >
        Rate Limits
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: 'white',
      border: '2px solid #333',
      borderRadius: '8px',
      padding: '15px',
      maxWidth: '350px',
      maxHeight: '400px',
      overflowY: 'auto',
      zIndex: 9999,
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      fontSize: '13px',
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '10px',
        borderBottom: '1px solid #ddd',
        paddingBottom: '10px',
      }}>
        <h3 style={{ margin: 0, fontSize: '16px' }}>Rate Limit Monitor</h3>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '0',
          }}
        >
          ×
        </button>
      </div>

      {Object.keys(rateLimits).length === 0 ? (
        <p style={{ color: '#666', fontStyle: 'italic' }}>No rate limits active</p>
      ) : (
        <>
          {Object.entries(rateLimits).map(([actionName, data]) => (
            <div
              key={actionName}
              style={{
                marginBottom: '12px',
                padding: '10px',
                backgroundColor: data.blocked ? '#ffe6e6' : '#f0f0f0',
                borderRadius: '5px',
                borderLeft: `4px solid ${data.blocked ? '#ff4444' : '#4CAF50'}`,
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '5px',
              }}>
                <strong style={{ textTransform: 'capitalize' }}>{actionName}</strong>
                <button
                  onClick={() => clearRateLimit(actionName)}
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    backgroundColor: '#ff4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              </div>
              
              <div style={{ fontSize: '12px', color: '#555' }}>
                <div>Attempts: {data.attempts} / {data.maxAttempts}</div>
                
                {/* Progress bar */}
                <div style={{
                  width: '100%',
                  height: '6px',
                  backgroundColor: '#ddd',
                  borderRadius: '3px',
                  marginTop: '5px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${(data.attempts / data.maxAttempts) * 100}%`,
                    height: '100%',
                    backgroundColor: data.blocked ? '#ff4444' : '#4CAF50',
                    transition: 'width 0.3s ease',
                  }} />
                </div>

                {data.blocked && (
                  <div style={{ 
                    marginTop: '5px', 
                    color: '#ff4444',
                    fontWeight: 'bold',
                  }}>
                    Blocked for {data.timeRemaining}s
                  </div>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={clearAllRateLimits}
            style={{
              width: '100%',
              padding: '8px',
              marginTop: '10px',
              backgroundColor: '#333',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Clear All Rate Limits
          </button>
        </>
      )}

      <div style={{
        marginTop: '15px',
        paddingTop: '10px',
        borderTop: '1px solid #ddd',
        fontSize: '11px',
        color: '#666',
      }}>
        <p style={{ margin: '5px 0' }}>
          <strong>Tip:</strong> Rate limits reset after 60 seconds of inactivity
        </p>
        <p style={{ margin: '5px 0' }}>
          <strong>Dev Mode Only:</strong> This component is hidden in production
        </p>
      </div>
    </div>
  );
}
