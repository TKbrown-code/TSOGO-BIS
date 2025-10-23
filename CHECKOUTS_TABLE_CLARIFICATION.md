# ✅ Checkouts Table Clarification

## 🎯 **IMPORTANT:**

### **We Use CHECKOUTS Table, NOT Orders Table**

The analytics system queries the **`checkouts`** table for all order data.

---

## 📋 **Checkouts Table Structure:**

```sql
CREATE TABLE public.checkouts (
  checkout_id bigint PRIMARY KEY,
  user_id uuid,
  user_name text NOT NULL,
  phone_number varchar NOT NULL,
  address text NOT NULL,
  total numeric(10,2) NOT NULL,
  status text DEFAULT 'pending',
  delivery_status text DEFAULT 'pending',
  tracking_link text,
  method_of_shipping text,
  items jsonb,  -- ← Items stored as JSONB array
  created_at timestamp DEFAULT now()
);
```

**Items JSONB Format:**
```json
[
  {
    "id": "product-uuid",
    "name": "Product Name",
    "price": 10000,
    "quantity": 2,
    "image": "image-url"
  }
]
```

**Note:** There is NO separate `checkout_items` table. Items are stored as JSONB in the `items` column.

---

## 🔍 **Status Field:**

The **`status`** field in the `checkouts` table represents the payment/order status:

### **Possible Values:**
- **`pending`** - Order placed, payment not confirmed
- **`paid`** - Payment confirmed, order paid
- **`processing`** - Order being processed
- **`cancelled`** - Order cancelled
- **`completed`** - Order completed (alternative to paid)

---

## 💰 **Analytics Filter:**

### **Admin Analytics Only Counts:**
```javascript
.from("checkouts")
.eq("status", "paid")  // ← Only paid checkouts
```

### **Why?**
- ✅ Accurate revenue tracking
- ✅ Only confirmed payments
- ✅ Excludes pending/cancelled
- ✅ Real business income

---

## 📈 **What Gets Counted:**

### **✅ INCLUDED (status = 'paid'):**
- Confirmed payments
- Actual revenue
- Completed transactions
- Real orders

### **❌ EXCLUDED (status ≠ 'paid'):**
- Pending checkouts (status = 'pending')
- Cancelled checkouts (status = 'cancelled')
- Processing checkouts (status = 'processing')

---

## 🎯 **Key Points:**

1. **Table Name:** `checkouts` (not `orders`)
2. **Status Field:** `status` (not `payment_status`)
3. **Filter Value:** `'paid'` (confirmed payments)
4. **Items Storage:** JSONB array in `items` column (no separate table)

---

## 📝 **Code Examples:**

### **Load All Paid Checkouts:**
```javascript
const { data: orders } = await supabase
  .from("checkouts")
  .select("*")
  .eq("status", "paid")
  .order("created_at", { ascending: false });

// Items are in the JSONB 'items' column
orders.forEach(order => {
  const items = order.items || []; // Array of items
  items.forEach(item => {
    console.log(item.name, item.quantity, item.price);
  });
});
```

### **Load User's Checkouts:**
```javascript
const { data: userOrders } = await supabase
  .from("checkouts")
  .select("*")
  .eq("user_id", userId)
  .order("created_at", { ascending: false });
```

### **Update Checkout Status:**
```javascript
const { error } = await supabase
  .from("checkouts")
  .update({ status: "paid" })
  .eq("checkout_id", checkoutId);
```

---

## ✅ **Summary:**

**Correct Usage:**
- ✅ Table: `checkouts`
- ✅ Field: `status`
- ✅ Value: `'paid'`
- ✅ Filter: `.eq("status", "paid")`

**Incorrect Usage:**
- ❌ Table: `orders`
- ❌ Field: `payment_status`
- ❌ Value: `'completed'`
- ❌ Filter: `.eq("payment_status", "paid")`

---

**Always use the `checkouts` table with `status = 'paid'` for analytics!** ✅
