import { showSiteModal as alert } from "../../utils/siteModal";
// src/admin/AdminSettings.jsx
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import { useAdmin } from "../../context/AdminContext";
import { useSiteSettings } from "../../context/SiteSettingsContext";
import { Users, Globe, Save, Lock, User, Settings, ShieldCheck, RefreshCw, Store } from "lucide-react";
import "./AdminSettings.css";

async function functionErrorMessage(error, data) {
  if (data?.error) return data.error;
  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try {
      const payload = await response.clone().json();
      if (payload?.error || payload?.message) {
        const message = payload.error || payload.message;
        return payload.detail ? `${message}: ${payload.detail}` : message;
      }
    } catch {
      try {
        const body = await response.clone().text();
        if (body) return body.slice(0, 240);
      } catch { /* keep the SDK message */ }
    }
  }
  return error?.message || "The admin service could not be reached.";
}

export default function AdminSettings() {
  const { t } = useTranslation();
  const { user, adminRole, signOut } = useAdmin();
  const { refreshSettings } = useSiteSettings();
  const [loading, setLoading] = useState(false);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [adminsError, setAdminsError] = useState("");
  const [admins, setAdmins] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Site settings
  const [siteName, setSiteName] = useState("TSOGO-BIS");
  const [siteEmail, setSiteEmail] = useState("");
  const [sitePhone, setSitePhone] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [currency, setCurrency] = useState("XAF");
  const [taxRate, setTaxRate] = useState("0");
  const [termsAndPolicies, setTermsAndPolicies] = useState("");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    loadAdmins();
    loadSiteSettings();
  }, []);

  async function loadAdmins() {
    setAdminsLoading(true);
    setAdminsError("");
    const { data, error } = await supabase.functions.invoke("manage-admins", {
      body: { action: "list" },
    });

    if (error) {
      console.error("Error loading admins:", error);
      setAdminsError(await functionErrorMessage(error, data));
      if ([401, 403].includes(error.context?.status)) await signOut();
    } else if (data?.error) {
      console.error("Error loading admins:", data.error);
      setAdminsError(data.error);
      if ([401, 403].includes(error?.context?.status)) await signOut();
    } else {
      setAdmins(data?.admins || []);
    }
    setAdminsLoading(false);
  }

  async function loadSiteSettings() {
    setSettingsLoading(true);
    setSettingsError("");
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Error loading site settings:", error);
      setSettingsError(error.message || "Site settings could not be loaded.");
      // Use defaults if no settings found
      setSettingsLoading(false);
      return;
    }

    if (data) {
      setSiteName(data.site_name || "TSOGO-BIS");
      setSiteEmail(data.contact_email || "");
      setSitePhone(data.contact_phone || "");
      setWhatsappPhone(data.whatsapp_phone || "");
      setCurrency(data.base_currency || "XAF");
      setTaxRate(((Number(data.tax_rate) || 0) * 100).toString());
      setTermsAndPolicies(data.terms_and_policies || "");
    }
    setSettingsLoading(false);
  }

  async function addAdmin() {
    if (!newAdminEmail.trim()) {
      alert("Please enter an email address");
      return;
    }

    if (adminRole !== "admin") {
      alert("Only admins can add admins");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-admins", {
      body: { action: "add", email: newAdminEmail.trim() },
    });

    if (error || data?.error) {
      alert("Error adding admin: " + await functionErrorMessage(error, data));
    } else {
      alert(data.invited
        ? "Invite sent. The new admin can sign in after accepting it."
        : "Admin access added to the existing account.");
      setNewAdminEmail("");
      setShowAddForm(false);
      loadAdmins();
    }
    setLoading(false);
  }

  async function deleteAdmin(adminId, email) {
    if (adminRole !== "admin") {
      alert("Only admins can remove admins");
      return;
    }

    if (!confirm(`Are you sure you want to remove admin access for ${email}?`)) {
      return;
    }

    const { data, error } = await supabase.functions.invoke("manage-admins", {
      body: { action: "remove", user_id: adminId },
    });

    if (error || data?.error) {
      alert("Error removing admin: " + await functionErrorMessage(error, data));
    } else {
      alert("Admin removed successfully!");
      loadAdmins();
    }
  }

  async function changePassword() {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("Please fill in all password fields");
      return;
    }

    if (newPassword.length < 6) {
      alert("New password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("New passwords do not match");
      return;
    }

    setChangingPassword(true);

    try {
      // First, verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (signInError) {
        alert("Current password is incorrect");
        setChangingPassword(false);
        return;
      }

      // If sign in successful, update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        alert("Error changing password: " + updateError.message);
      } else {
        alert("Password changed successfully!");
        // Clear form
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      alert("Error: " + error.message);
    }

    setChangingPassword(false);
  }

  async function saveSiteSettings() {
    setSavingSettings(true);

    const settingsData = {
      site_name: siteName,
      contact_email: siteEmail,
      contact_phone: sitePhone,
      whatsapp_phone: whatsappPhone.replace(/[^\d+]/g, ""),
      base_currency: currency,
      tax_rate: (parseFloat(taxRate) || 0) / 100,
      terms_and_policies: termsAndPolicies
    };

    const { error } = await supabase.from("site_settings").upsert({ id: true, ...settingsData }, { onConflict: "id" });

    if (error) {
      alert("Error saving settings: " + error.message);
    } else {
      alert("Site settings saved successfully!");
      // Refresh the global settings context
      refreshSettings();
    }

    setSavingSettings(false);
  }

  return (
    <div className="admin-settings">
      <div className="settings-header">
        <div>
          <span className="settings-eyebrow">STORE CONTROL</span>
          <h1><Settings className="inline-block mr-2" size={28} /> {t('admin.settings.title')}</h1>
          <p className="subtitle">{t('admin.settings.subtitle')}</p>
        </div>
        <div className="settings-header-note"><ShieldCheck size={16} /> Changes apply across the storefront</div>
      </div>

      {/* Admin Management Section */}
      <div className="settings-section">
        <div className="section-header">
          <div><h2><Users className="inline-block mr-2" size={20} /> {t('admin.settings.admin_users')}</h2><p>Manage who can access the admin workspace.</p></div>
          {adminRole === "admin" && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn-add"
            >
              {showAddForm ? t('admin.settings.cancel') : `+ ${t('admin.settings.add_admin')}`}
            </button>
          )}
        </div>

        {showAddForm && (
          <div className="add-admin-form">
            <div className="form-row">
              <input
                type="email"
                placeholder={t('admin.settings.admin_email')}
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="input-email"
              />
              <button
                onClick={addAdmin}
                disabled={loading}
                className="btn-save"
              >
                {loading ? t('admin.settings.adding') : t('admin.settings.add_admin')}
              </button>
            </div>
            <p className="form-hint">
              {t('admin.settings.form_hint')}
            </p>
          </div>
        )}

        {adminsError && <div className="settings-inline-error" role="alert"><span>{adminsError}</span><button type="button" onClick={loadAdmins}><RefreshCw size={14} /> Retry</button></div>}
        {adminsLoading && !showAddForm ? (
          <div className="loading-state">
            <div className="settings-skeleton"><i /><i /><i /></div>
            <p>Loading administrators…</p>
          </div>
        ) : !adminsError && (
          <div className="admins-table-container">
            <table className="admins-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.user_id}>
                    <td>
                      <div className="admin-email-cell">
                        <div className="admin-avatar-small">
                          {admin.email ? admin.email.charAt(0).toUpperCase() : "?"}
                        </div>
                        <span>{admin.email || "No email"}</span>
                        {admin.email === user?.email && (
                          <span className="you-badge">You</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="role-badge admin">Admin</span>
                    </td>
                    <td>{admin.created_at ? new Date(admin.created_at).toLocaleDateString() : "—"}</td>
                    <td>
                      {adminRole === "admin" && admin.user_id !== user?.id ? (
                        <button
                          onClick={() => deleteAdmin(admin.user_id, admin.email)}
                          className="btn-delete-small"
                        >
                          {t('admin.settings.remove')}
                        </button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {admins.length === 0 && <tr><td colSpan="4" className="settings-table-empty">No administrator accounts were returned.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Site Settings Section */}
      <div className="settings-section">
        <div className="section-header">
          <div><h2><Globe className="inline-block mr-2" size={20} /> {t('admin.settings.site_settings')}</h2><p>Store identity, contact details, currency, tax, and public policies.</p></div>
        </div>

        {settingsError && <div className="settings-inline-error" role="alert"><span>{settingsError}</span><button type="button" onClick={loadSiteSettings}><RefreshCw size={14} /> Retry</button></div>}
        {settingsLoading ? <div className="settings-form-skeleton"><i /><i /><i /><i /></div> : <div className="settings-form">
          <div className="settings-form-intro"><Store size={17} /><span>Store profile</span></div>
          <div className="settings-form-grid">
          <div className="form-group">
            <label>{t('admin.settings.site_name')}</label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="TSOGO-BIS"
            />
          </div>

          <div className="form-group">
            <label>{t('admin.settings.contact_email')}</label>
            <input
              type="email"
              value={siteEmail}
              onChange={(e) => setSiteEmail(e.target.value)}
              placeholder="admin@tsogo-bis.com"
            />
          </div>
          </div>

          <div className="form-group">
            <label>{t('admin.settings.contact_phone')}</label>
            <input
              type="tel"
              value={sitePhone}
              onChange={(e) => setSitePhone(e.target.value)}
              placeholder="+237 XXX XXX XXX"
            />
          </div>

          <div className="form-group">
            <label>{t('admin.settings.whatsapp_phone')}</label>
            <input
              type="tel"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="+237 680 633 832"
              autoComplete="tel"
            />
            <small>{t('admin.settings.whatsapp_phone_hint')}</small>
          </div>

          <div className="form-row-inline">
            <div className="form-group">
              <label>{t('admin.settings.currency')}</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="XAF">{t('admin.settings.xaf')}</option>
                <option value="USD">{t('admin.settings.usd')}</option>
                <option value="EUR">{t('admin.settings.eur')}</option>
              </select>
            </div>

            <div className="form-group">
              <label>{t('admin.settings.tax_rate')}</label>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="0"
                min="0"
                max="100"
                step="0.1"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="site-terms">Terms and policies</label>
            <small>Edit the content shown on the public Terms and Policies page. Plain text is supported; separate sections with blank lines.</small>
            <textarea
              id="site-terms"
              value={termsAndPolicies}
              onChange={(event) => setTermsAndPolicies(event.target.value)}
              rows={16}
              placeholder="Terms and policies content"
            />
          </div>

          <div className="settings-save-row"><span>Changes are saved to the live storefront.</span><button type="button" onClick={saveSiteSettings} className="btn-save-settings" disabled={savingSettings}>
            <Save className="inline-block mr-1" size={16} /> {savingSettings ? "Saving changes…" : t('admin.settings.save_settings')}
          </button></div>
        </div>
        }
      </div>

      {/* Admin access model */}
      <div className="settings-section">
        <div className="section-header">
          <h2><Lock className="inline-block mr-2" size={20} /> Admin access</h2>
        </div>
        <p>All users listed above have the same admin access. Admins can invite new admins from this dashboard and remove other admins. The last remaining admin cannot be removed.</p>
      </div>

      {/* Change Password Section */}
      <div className="settings-section">
        <div className="section-header">
          <div><h2><Lock className="inline-block mr-2" size={20} /> Change Password</h2><p>Update the password for your administrator account.</p></div>
        </div>

        <div className="settings-form">
          <div className="form-group">
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              autoComplete="current-password"
            />
            <small>You must enter your current password to change it</small>
          </div>

          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 characters)"
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
          </div>

          <button 
            onClick={changePassword} 
            className="btn-save-settings"
            disabled={changingPassword}
          >
            {changingPassword ? "Changing Password..." : <><Lock className="inline-block mr-1" size={16} /> Change Password</>}
          </button>
        </div>
      </div>

      {/* Current User Info */}
      <div className="settings-section">
        <div className="section-header">
          <div><h2><User className="inline-block mr-2" size={20} /> Your Account</h2><p>Identity and access details for the signed-in administrator.</p></div>
        </div>

        <div className="account-info">
          <div className="info-row">
            <span className="label">Email:</span>
            <span className="value">{user?.email || "Not available"}</span>
          </div>
          <div className="info-row">
            <span className="label">Role:</span>
            <span className={`role-badge ${adminRole || "moderator"}`}>
              {adminRole ? adminRole.replace("_", " ") : "moderator"}
            </span>
          </div>
          <div className="info-row">
            <span className="label">User ID:</span>
            <span className="value code">{user?.id || "Not available"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
