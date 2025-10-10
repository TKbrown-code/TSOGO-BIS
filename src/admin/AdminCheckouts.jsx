import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminCheckouts() {
  const [checkouts, setCheckouts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("checkouts")
      .select("id, visitor_id, user_name, email, address, payment_method, total, created_at, checkout_items (product_id, quantity, price)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) console.error(error);
    else setCheckouts(data || []);
    setLoading(false);
  }

  function exportCSV() {
    const rows = [["checkout_id","name","email","address","payment_method","total","items","created_at"]];
    checkouts.forEach(c => {
      const items = (c.checkout_items || []).map(it => `${it.product_id}x${it.quantity}@${it.price}`).join("; ");
      rows.push([c.id, c.user_name, c.email, c.address, c.payment_method, c.total, items, c.created_at]);
    });
    const csv = rows.map(r => r.map(escapeCSV).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `checkouts_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function escapeCSV(val) {
    if (val == null) return "";
    const s = String(val).replace(/"/g, '""');
    if (s.search(/("|,|\n)/g) >= 0) return `"${s}"`;
    return s;
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h3>Checkouts</h3>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={load}>Reload</button>
        <button onClick={exportCSV}>Export CSV</button>
      </div>
      {loading ? <p>Loading...</p> : (
        <div style={{ marginTop: 12 }}>
          {checkouts.map(c => (
            <div key={c.id} style={{ padding: 8, borderBottom: "1px solid #eee" }}>
              <div><strong>Order #{c.id}</strong> — {new Date(c.created_at).toLocaleString()}</div>
              <div>{c.user_name} • {c.email} • {c.payment_method}</div>
              <div>Total: ${Number(c.total).toFixed(2)}</div>
              <div>Items: {(c.checkout_items || []).map(i => `${i.product_id} x${i.quantity}`).join(", ")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
