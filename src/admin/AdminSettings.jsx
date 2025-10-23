// src/admin/AdminSettings.jsx
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAdmin } from "../context/AdminContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { Users, Globe, Save, Lock, User, Settings, CheckCircle, XCircle } from "lucide-react";
import "../styles/AdminSettings.css";

export default function AdminSettings() {
  const { t } = useTranslation();
  const { user, adminRole } = useAdmin();
  const { refreshSettings } = useSiteSettings();
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminRole, setNewAdminRole] = useState("moderator");
  const [showAddForm, setShowAddForm] = useState(false);

  // Site settings
  const [siteName, setSiteName] = useState("TSOGO-BIS");
  const [siteEmail, setSiteEmail] = useState("");
  const [sitePhone, setSitePhone] = useState("");
  const [currency, setCurrency] = useState("XAF");
  const [taxRate, setTaxRate] = useState("0");

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
    setLoading(true);
    const { data, error } = await supabase
      .from("admins")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading admins:", error);
    } else {
      setAdmins(data || []);
    }
    setLoading(false);
  }

  async function loadSiteSettings() {
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .single();

    if (error) {
      console.error("Error loading site settings:", error);
      // Use defaults if no settings found
      return;
    }

    if (data) {
      setSiteName(data.site_name || "TSOGO-BIS");
      setSiteEmail(data.site_email || "");
      setSitePhone(data.site_phone || "");
      setCurrency(data.currency || "XAF");
      setTaxRate(data.tax_rate?.toString() || "0");
    }
  }

  async function addAdmin() {
    if (!newAdminEmail.trim()) {
      alert("Please enter an email address");
      return;
    }

    // Check if admin can add admins (only super_admin)
    if (adminRole !== "super_admin") {
      alert("Only super admins can add new admins");
      return;
    }

    setLoading(true);

    // First, find the user by email in the profiles table
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", newAdminEmail.trim())
      .single();

    if (profileError || !profileData) {
      alert("User not found. The user must have an account first.");
      setLoading(false);
      return;
    }

    // Now insert into admins table with the user_id
    const { error } = await supabase
      .from("admins")
      .insert({
        id: profileData.user_id,
        email: newAdminEmail.trim(),
        role: newAdminRole
      });

    if (error) {
      alert("Error adding admin: " + error.message);
    } else {
      alert("Admin added successfully!");
      setNewAdminEmail("");
      setNewAdminRole("moderator");
      setShowAddForm(false);
      loadAdmins();
    }
    setLoading(false);
  }

  async function deleteAdmin(adminId, email) {
    if (adminRole !== "super_admin") {
      alert("Only super admins can delete admins");
      return;
    }

    if (!confirm(`Are you sure you want to remove admin access for ${email}?`)) {
      return;
    }

    const { error } = await supabase
      .from("admins")
      .delete()
      .eq("id", adminId);

    if (error) {
      alert("Error removing admin: " + error.message);
    } else {
      alert("Admin removed successfully!");
      loadAdmins();
    }
  }

  async function updateAdminRole(adminId, newRole) {
    if (adminRole !== "super_admin") {
      alert("Only super admins can change roles");
      return;
    }

    const { error } = await supabase
      .from("admins")
      .update({ role: newRole })
      .eq("id", adminId);

    if (error) {
      alert("Error updating role: " + error.message);
    } else {
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
    setLoading(true);

    // Get the first (and only) settings record
    const { data: existingSettings } = await supabase
      .from("site_settings")
      .select("id")
      .single();

    const settingsData = {
      site_name: siteName,
      site_email: siteEmail,
      site_phone: sitePhone,
      currency: currency,
      tax_rate: parseFloat(taxRate) || 0
    };

    let error;

    if (existingSettings) {
      // Update existing settings
      const result = await supabase
        .from("site_settings")
        .update(settingsData)
        .eq("id", existingSettings.id);
      error = result.error;
    } else {
      // Insert new settings (first time)
      const result = await supabase
        .from("site_settings")
        .insert(settingsData);
      error = result.error;
    }

    if (error) {
      alert("Error saving settings: " + error.message);
    } else {
      alert("Site settings saved successfully!");
      // Refresh the global settings context
      refreshSettings();
    }

    setLoading(false);
  }

  return (
    <div className="admin-settings">
      <div className="settings-header">
        <div>
          <h1><Settings className="inline-block mr-2" size={28} /> {t('admin.settings.title')}</h1>
          <p className="subtitle">{t('admin.settings.subtitle')}</p>
        </div>
      </div>

      {/* Admin Management Section */}
      <div className="settings-section">
        <div className="section-header">
          <h2><Users className="inline-block mr-2" size={20} /> {t('admin.settings.admin_users')}</h2>
          {adminRole === "super_admin" && (
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
              <select
                value={newAdminRole}
                onChange={(e) => setNewAdminRole(e.target.value)}
                className="select-role"
              >
                <option value="moderator">{t('admin.settings.moderator')}</option>
                <option value="admin">{t('admin.settings.admin')}</option>
                <option value="super_admin">{t('admin.settings.super_admin')}</option>
              </select>
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

        {loading && !showAddForm ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading admins...</p>
          </div>
        ) : (
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
                  <tr key={admin.id}>
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
                      {adminRole === "super_admin" && admin.email !== user?.email ? (
                        <select
                          value={admin.role || "moderator"}
                          onChange={(e) => updateAdminRole(admin.id, e.target.value)}
                          className="role-select"
                        >
                          <option value="moderator">{t('admin.settings.moderator')}</option>
                          <option value="admin">{t('admin.settings.admin')}</option>
                          <option value="super_admin">{t('admin.settings.super_admin')}</option>
                        </select>
                      ) : (
                        <span className={`role-badge ${admin.role || "moderator"}`}>
                          {admin.role ? admin.role.replace("_", " ") : "moderator"}
                        </span>
                      )}
                    </td>
                    <td>{admin.created_at ? new Date(admin.created_at).toLocaleDateString() : "—"}</td>
                    <td>
                      {adminRole === "super_admin" && admin.email !== user?.email ? (
                        <button
                          onClick={() => deleteAdmin(admin.id, admin.email)}
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
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Site Settings Section */}
      <div className="settings-section">
        <div className="section-header">
          <h2><Globe className="inline-block mr-2" size={20} /> {t('admin.settings.site_settings')}</h2>
        </div>

        <div className="settings-form">
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

          <div className="form-group">
            <label>{t('admin.settings.contact_phone')}</label>
            <input
              type="tel"
              value={sitePhone}
              onChange={(e) => setSitePhone(e.target.value)}
              placeholder="+237 XXX XXX XXX"
            />
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

          <button onClick={saveSiteSettings} className="btn-save-settings">
            <Save className="inline-block mr-1" size={16} /> {t('admin.settings.save_settings')}
          </button>
        </div>
      </div>

      {/* Role Permissions Info */}
      <div className="settings-section">
        <div className="section-header">
          <h2><Lock className="inline-block mr-2" size={20} /> Role Permissions</h2>
        </div>

        <div className="permissions-grid">
          <div className="permission-card">
            <div className="permission-header">
              <span className="role-badge moderator">Moderator</span>
            </div>
            <ul className="permission-list">
              <li><CheckCircle className="inline-block mr-1" size={14} /> View dashboard</li>
              <li><CheckCircle className="inline-block mr-1" size={14} /> Manage products</li>
              <li><CheckCircle className="inline-block mr-1" size={14} /> View orders</li>
              <li><CheckCircle className="inline-block mr-1" size={14} /> Manage reviews</li>
              <li><XCircle className="inline-block mr-1" size={14} /> Manage users</li>
              <li><XCircle className="inline-block mr-1" size={14} /> Manage admins</li>
            </ul>
          </div>

          <div className="permission-card">
            <div className="permission-header">
              <span className="role-badge admin">Admin</span>
            </div>
            <ul className="permission-list">
              <li><CheckCircle className="inline-block mr-1" size={14} /> View dashboard</li>
              <li><CheckCircle className="inline-block mr-1" size={14} /> Manage products</li>
              <li><CheckCircle className="inline-block mr-1" size={14} /> Manage orders</li>
              <li><CheckCircle className="inline-block mr-1" size={14} /> Manage reviews</li>
              <li><CheckCircle className="inline-block mr-1" size={14} /> Manage users</li>
              <li><XCircle className="inline-block mr-1" size={14} /> Manage admins</li>
            </ul>
          </div>

          <div className="permission-card">
            <div className="permission-header">
              <span className="role-badge super_admin">Super Admin</span>
            </div>
            <ul className="permission-list">
              <li><CheckCircle className="inline-block mr-1" size={14} /> View dashboard</li>
              <li><CheckCircle className="inline-block mr-1" size={14} /> Manage products</li>
              <li><CheckCircle className="inline-block mr-1" size={14} /> Manage orders</li>
              <li><CheckCircle className="inline-block mr-1" size={14} /> Manage reviews</li>
              <li><CheckCircle className="inline-block mr-1" size={14} /> Manage users</li>
              <li><CheckCircle className="inline-block mr-1" size={14} /> Manage admins</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Change Password Section */}
      <div className="settings-section">
        <div className="section-header">
          <h2><Lock className="inline-block mr-2" size={20} /> Change Password</h2>
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
          <h2><User className="inline-block mr-2" size={20} /> Your Account</h2>
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
