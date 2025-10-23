# 🌐 Site Settings Implementation Guide

## ✅ **What Was Created:**

### **1. Database Table: `site_settings`**

**File:** `database/site_settings_table.sql`

**Schema:**
```sql
- id (UUID, primary key)
- site_name (TEXT, default: 'TSOGO-BIS')
- site_email (TEXT)
- site_phone (TEXT)
- currency (TEXT, default: 'XAF')
- tax_rate (DECIMAL, default: 0.00)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

**Features:**
- Auto-updates `updated_at` timestamp on changes
- RLS enabled (public read, authenticated update)
- Only one row should exist (singleton pattern)
- Default values inserted on creation

---

### **2. React Context: `SiteSettingsContext`**

**File:** `src/context/SiteSettingsContext.jsx`

**Provides:**
- Global access to site settings
- Auto-loads settings on app start
- Refresh function to reload after updates

**Usage:**
```javascript
import { useSiteSettings } from "../context/SiteSettingsContext";

function MyComponent() {
  const { siteName, siteEmail, currency, taxRate, loading } = useSiteSettings();
  
  return (
    <div>
      <h1>{siteName}</h1>
      <p>Email: {siteEmail}</p>
      <p>Currency: {currency}</p>
    </div>
  );
}
```

---

### **3. Admin Settings Integration**

**File:** `src/admin/AdminSettings.jsx`

**Features:**
- Load settings from database
- Edit all settings in form
- Save to database
- Auto-refresh global context after save

---

## 🚀 **How to Use Site Settings in Your App:**

### **Step 1: Run the SQL Migration**

Execute the SQL file in your Supabase dashboard:
```bash
database/site_settings_table.sql
```

This will:
- Create the `site_settings` table
- Insert default values
- Set up triggers and policies

---

### **Step 2: Use Settings in Components**

#### **Example 1: Display Site Name in Navbar**

```javascript
// src/components/Navbar.jsx
import { useSiteSettings } from "../context/SiteSettingsContext";

export default function Navbar() {
  const { siteName } = useSiteSettings();
  
  return (
    <nav>
      <div className="logo">{siteName}</div>
      {/* ... rest of navbar */}
    </nav>
  );
}
```

#### **Example 2: Use Currency in Checkout**

```javascript
// src/pages/Checkout.jsx
import { useSiteSettings } from "../context/SiteSettingsContext";

export default function Checkout() {
  const { currency, taxRate } = useSiteSettings();
  
  const subtotal = 10000;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;
  
  return (
    <div>
      <p>Subtotal: {subtotal} {currency}</p>
      <p>Tax ({taxRate}%): {tax} {currency}</p>
      <p>Total: {total} {currency}</p>
    </div>
  );
}
```

#### **Example 3: Contact Information in Footer**

```javascript
// src/components/Footer.jsx
import { useSiteSettings } from "../context/SiteSettingsContext";

export default function Footer() {
  const { siteName, siteEmail, sitePhone } = useSiteSettings();
  
  return (
    <footer>
      <h3>{siteName}</h3>
      <p>Email: {siteEmail}</p>
      <p>Phone: {sitePhone}</p>
    </footer>
  );
}
```

#### **Example 4: Loading State**

```javascript
import { useSiteSettings } from "../context/SiteSettingsContext";

export default function MyComponent() {
  const { settings, loading } = useSiteSettings();
  
  if (loading) {
    return <div>Loading settings...</div>;
  }
  
  return (
    <div>
      <h1>{settings.site_name}</h1>
    </div>
  );
}
```

---

## 📊 **Available Settings:**

### **From Context:**

```javascript
const {
  // Individual values
  siteName,      // string
  siteEmail,     // string
  sitePhone,     // string
  currency,      // string (XAF, USD, EUR)
  taxRate,       // number (0-100)
  
  // Full settings object
  settings,      // { site_name, site_email, site_phone, currency, tax_rate }
  
  // State
  loading,       // boolean
  
  // Functions
  refreshSettings  // function to reload settings
} = useSiteSettings();
```

---

## 🔧 **Admin Management:**

### **Update Settings:**

1. Go to Admin Panel → Settings
2. Scroll to "Site Settings" section
3. Update any field:
   - Site Name
   - Contact Email
   - Contact Phone
   - Currency (XAF/USD/EUR)
   - Tax Rate (%)
4. Click "💾 Save Site Settings"
5. Settings are saved to database
6. Global context auto-refreshes
7. All components using settings update automatically

---

## 🎯 **Common Use Cases:**

### **1. Dynamic Site Title**

```javascript
// src/App.jsx or any component
import { useSiteSettings } from "./context/SiteSettingsContext";
import { useEffect } from "react";

export default function App() {
  const { siteName } = useSiteSettings();
  
  useEffect(() => {
    document.title = siteName;
  }, [siteName]);
  
  return <div>...</div>;
}
```

### **2. Price Formatting with Currency**

```javascript
import { useSiteSettings } from "../context/SiteSettingsContext";

export function formatPrice(amount) {
  const { currency } = useSiteSettings();
  
  const symbols = {
    XAF: 'XAF',
    USD: '$',
    EUR: '€'
  };
  
  return `${symbols[currency] || currency} ${amount.toLocaleString()}`;
}
```

### **3. Calculate Tax**

```javascript
import { useSiteSettings } from "../context/SiteSettingsContext";

export function calculateTotal(subtotal) {
  const { taxRate } = useSiteSettings();
  
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;
  
  return { subtotal, tax, total };
}
```

### **4. Contact Links**

```javascript
import { useSiteSettings } from "../context/SiteSettingsContext";

export default function ContactButtons() {
  const { siteEmail, sitePhone } = useSiteSettings();
  
  return (
    <div>
      <a href={`mailto:${siteEmail}`}>Email Us</a>
      <a href={`tel:${sitePhone}`}>Call Us</a>
    </div>
  );
}
```

---

## 🔄 **How It Works:**

### **Flow:**

1. **App Starts** → `SiteSettingsProvider` loads settings from database
2. **Settings Loaded** → Available to all components via `useSiteSettings()`
3. **Admin Updates** → Settings saved to database
4. **Context Refreshes** → `refreshSettings()` called
5. **Components Update** → All components using settings re-render with new values

### **Architecture:**

```
┌─────────────────────────────────────┐
│     Supabase (site_settings)        │
│  ┌─────────────────────────────┐   │
│  │ site_name: "TSOGO-BIS"      │   │
│  │ site_email: "admin@..."     │   │
│  │ currency: "XAF"             │   │
│  │ tax_rate: 0                 │   │
│  └─────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│    SiteSettingsContext (React)      │
│  ┌─────────────────────────────┐   │
│  │ Loads on app start          │   │
│  │ Provides to all components  │   │
│  │ Refreshes on admin update   │   │
│  └─────────────────────────────┘   │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│        Your Components              │
│  ┌─────────────────────────────┐   │
│  │ Navbar (uses siteName)      │   │
│  │ Footer (uses contact info)  │   │
│  │ Checkout (uses currency)    │   │
│  │ Admin (edits settings)      │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## ✅ **Benefits:**

1. **Centralized** - One place to manage site-wide settings
2. **Dynamic** - Update without code changes
3. **Real-time** - Changes reflect immediately
4. **Type-safe** - Context provides typed values
5. **Persistent** - Stored in database
6. **Admin-friendly** - Easy to update via UI

---

## 🎉 **Summary:**

✅ **Database table created** (`site_settings`)  
✅ **React context created** (`SiteSettingsContext`)  
✅ **Admin UI integrated** (Settings page)  
✅ **Global provider added** (`main.jsx`)  
✅ **Auto-refresh on update**  
✅ **Ready to use everywhere**  

**Now you can use site settings throughout your entire app!** 🚀

---

## 📝 **Next Steps:**

1. Run the SQL migration in Supabase
2. Update components to use `useSiteSettings()`
3. Replace hardcoded values with dynamic settings
4. Test admin settings update flow

**Example components to update:**
- Navbar (site name)
- Footer (contact info)
- Checkout (currency, tax rate)
- Product pages (currency)
- Contact page (email, phone)
