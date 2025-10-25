import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import verifyCampayPayment from "../utils/fapshi";

export default function Fapshi() {
  const location = useLocation();
  const payload = location.state; // Get the payload data from navigation state

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!payload) {
        throw new Error("No payment data received. Please complete checkout first.");
      }

      const res = await verifyCampayPayment({
        reference: payload.reference,
        checkout_id: payload.checkout_id
      });
      setResult(res);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Fapshi / Campay Payment Processing</h2>
      <p>This page processes the Campay order using data from your checkout.</p>
      
      {payload ? (
        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <h4>Payment Data Received:</h4>
          <pre style={{ whiteSpace: "pre-wrap", backgroundColor: "#f5f5f5", padding: 10, borderRadius: 4 }}>
            {JSON.stringify(payload, null, 2)}
          </pre>
          {payload.paymentUrl && (
            <div style={{ marginTop: 12 }}>
              <p>Complete your payment by clicking the link below:</p>
              <a 
                href={payload.paymentUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  display: 'inline-block',
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: 4
                }}
              >
                Complete Payment
              </a>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 12, marginBottom: 12, color: "orange" }}>
          No payment data received. Please go back to checkout.
        </div>
      )}
      
      <div style={{ marginTop: 12 }}>
        <button onClick={handleCreate} disabled={loading || !payload}>
          {loading ? "Verifying..." : "Verify Payment Status"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, color: "crimson" }}>
          Error: {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12 }}>
          <h4>Result</h4>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
