"use client";

import { useState } from "react";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess(false);
    const res = await fetch("/api/users/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}
      {success && (
        <div style={{ background: "var(--success-bg)", color: "var(--success)", borderRadius: 6, padding: "0.6rem 0.8rem", fontSize: "0.82rem", marginBottom: "1rem" }}>
          Password updated.
        </div>
      )}
      <div className="field">
        <label>Current password</label>
        <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </div>
      <div className="field">
        <label>New password (min. 8 characters)</label>
        <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </div>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving..." : "Update password"}
      </button>
    </form>
  );
}
