"use client";

import { useState, useEffect, useCallback } from "react";
import { SETTING_KEYS } from "@/lib/constants";
import {
  DEFAULT_KEYBINDINGS,
  formatKeyDisplay,
  eventToKeyString,
  KEYBINDINGS_SETTING_KEY,
  CATEGORY_LABELS,
} from "@/lib/keybindings";

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

function announce(message: string) {
  const el = document.getElementById("live-announcements");
  if (el) {
    el.textContent = "";
    setTimeout(() => {
      el.textContent = message;
    }, 50);
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  
  // User context
  const [userRole, setUserRole] = useState("CHILD");
  const [assignedNumbers, setAssignedNumbers] = useState<{id: string, phoneNumber: string}[]>([]);
  const [maxParallelDials, setMaxParallelDials] = useState(1);

  // New template form
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateSubject, setNewTemplateSubject] = useState("");
  const [newTemplateBody, setNewTemplateBody] = useState("");

  // Keybindings
  const [customBindings, setCustomBindings] = useState<Record<string, string>>({});
  const [rebindingId, setRebindingId] = useState<string | null>(null);

  const getKey = useCallback(
    (id: string) => {
      if (customBindings[id]) return customBindings[id];
      const def = DEFAULT_KEYBINDINGS.find((kb) => kb.id === id);
      return def?.defaultKey || "";
    },
    [customBindings]
  );

  // Load settings and templates
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => {
        if (data.role) setUserRole(data.role);
      })
      .catch(console.error);

    fetch("/api/user/twilio")
      .then(r => r.json())
      .then(data => setAssignedNumbers(Array.isArray(data) ? data : []))
      .catch(console.error);

    fetch("/api/user/dialer")
      .then(r => r.json())
      .then(data => setMaxParallelDials(data.maxParallelDials || 1))
      .catch(console.error);

    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const d = data && typeof data === 'object' && !data.error ? data : {};
        setSettings(d);
        // Parse custom keybindings
        if (d[KEYBINDINGS_SETTING_KEY]) {
          try {
            setCustomBindings(JSON.parse(d[KEYBINDINGS_SETTING_KEY]));
          } catch { /* use defaults */ }
        }
      })
      .catch(console.error);

    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    setStatus("");
    announce("Saving settings");

    try {
      // Save dialer config
      await fetch("/api/user/dialer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxParallelDials }),
      });

      // Save global settings
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error("Failed to save");
      setStatus("Settings saved successfully");
      announce("Settings saved successfully");
    } catch {
      setStatus("Failed to save settings");
      announce("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName || !newTemplateSubject || !newTemplateBody) {
      setStatus("Please fill in all template fields");
      announce("Please fill in all template fields");
      return;
    }

    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTemplateName,
          subject: newTemplateSubject,
          body: newTemplateBody,
        }),
      });

      if (!res.ok) throw new Error("Failed to create");

      const template = await res.json();
      setTemplates((prev) => [template, ...prev]);
      setNewTemplateName("");
      setNewTemplateSubject("");
      setNewTemplateBody("");
      setStatus(`Template "${template.name}" created`);
      announce(`Email template ${template.name} created successfully`);
    } catch {
      setStatus("Failed to create template");
      announce("Failed to create template");
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;

    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setStatus(`Template "${name}" deleted`);
      announce(`Template ${name} deleted`);
    } catch {
      setStatus("Failed to delete template");
      announce("Failed to delete template");
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 24px" }}>
      <h2 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: "8px" }}>
        Settings
      </h2>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: "32px" }}>
        Configure your Twilio and Gmail credentials. All settings are stored locally.
      </p>

      {/* Status message */}
      {status && (
        <div
          role="status"
          aria-live="assertive"
          style={{
            padding: "12px 16px",
            marginBottom: "24px",
            borderRadius: "8px",
            fontSize: "0.875rem",
            fontWeight: 600,
            backgroundColor: status.includes("fail") || status.includes("Failed") || status.includes("Please")
              ? "rgba(238, 68, 68, 0.15)"
              : "rgba(68, 187, 102, 0.15)",
            color: status.includes("fail") || status.includes("Failed") || status.includes("Please")
              ? "#ff6666"
              : "#66dd88",
          }}
        >
          {status}
        </div>
      )}

      {/* Parallel Dialer Settings */}
      <section aria-labelledby="dialer-heading" className="card" style={{ marginBottom: "24px", border: "1px solid var(--color-blue)", background: "rgba(59, 130, 246, 0.05)" }}>
        <h3 id="dialer-heading" style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "16px", margin: "0 0 16px", color: "var(--color-blue)" }}>
          🚀 Parallel Dialer
        </h3>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <label htmlFor="parallel-dials" className="form-label">
              Max Parallel Dials (1-10)
            </label>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "8px" }}>
              Controls how many leads are called simultaneously when you click "Call".
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <input
                id="parallel-dials"
                type="range"
                min="1"
                max="10"
                value={maxParallelDials}
                onChange={(e) => setMaxParallelDials(parseInt(e.target.value) || 1)}
                style={{ flex: 1, accentColor: "var(--color-blue)" }}
              />
              <span style={{ fontSize: "1.25rem", fontWeight: 700, minWidth: "40px", textAlign: "center", color: "var(--color-blue)" }}>
                {maxParallelDials}
              </span>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "8px" }}>Your Assigned Caller IDs:</h4>
            {assignedNumbers.length === 0 ? (
              <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                No phone numbers assigned by Admin. Parallel dialing will not work until numbers are assigned.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {assignedNumbers.map((num) => (
                  <span key={num.id} style={{ background: "rgba(255,255,255,0.1)", padding: "4px 8px", borderRadius: "4px", fontSize: "0.8125rem", fontFamily: "monospace" }}>
                    {num.phoneNumber}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Twilio Settings */}
      {userRole === 'MASTER' && (
      <section aria-labelledby="twilio-heading" className="card" style={{ marginBottom: "24px" }}>
        <h3 id="twilio-heading" style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "16px", margin: "0 0 16px" }}>
          📞 Twilio Configuration
        </h3>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "16px" }}>
          Get these from your{" "}
          <a
            href="https://console.twilio.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-accent)" }}
          >
            Twilio Console
          </a>.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label htmlFor="twilio-sid" className="form-label">
              Account SID <span aria-hidden="true">*</span>
            </label>
            <input
              id="twilio-sid"
              type="text"
              className="form-input"
              value={settings[SETTING_KEYS.TWILIO_ACCOUNT_SID] || ""}
              onChange={(e) => updateSetting(SETTING_KEYS.TWILIO_ACCOUNT_SID, e.target.value)}
              placeholder="AC..."
              aria-required="true"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="twilio-token" className="form-label">
              Auth Token <span aria-hidden="true">*</span>
            </label>
            <input
              id="twilio-token"
              type="password"
              className="form-input"
              value={settings[SETTING_KEYS.TWILIO_AUTH_TOKEN] || ""}
              onChange={(e) => updateSetting(SETTING_KEYS.TWILIO_AUTH_TOKEN, e.target.value)}
              placeholder="Your Twilio auth token"
              aria-required="true"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="twilio-phone" className="form-label">
              Twilio Phone Number <span aria-hidden="true">*</span>
            </label>
            <input
              id="twilio-phone"
              type="tel"
              className="form-input"
              value={settings[SETTING_KEYS.TWILIO_PHONE_NUMBER] || ""}
              onChange={(e) => updateSetting(SETTING_KEYS.TWILIO_PHONE_NUMBER, e.target.value)}
              placeholder="+1234567890"
              aria-required="true"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="twilio-api-key" className="form-label">
              API Key SID <span aria-hidden="true">*</span>
            </label>
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", margin: "0 0 6px" }}>
              Create one at Twilio Console → Account → API keys &amp; tokens.
            </p>
            <input
              id="twilio-api-key"
              type="text"
              className="form-input"
              value={settings[SETTING_KEYS.TWILIO_API_KEY_SID] || ""}
              onChange={(e) => updateSetting(SETTING_KEYS.TWILIO_API_KEY_SID, e.target.value)}
              placeholder="SK..."
              aria-required="true"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="twilio-api-secret" className="form-label">
              API Key Secret <span aria-hidden="true">*</span>
            </label>
            <input
              id="twilio-api-secret"
              type="password"
              className="form-input"
              value={settings[SETTING_KEYS.TWILIO_API_KEY_SECRET] || ""}
              onChange={(e) => updateSetting(SETTING_KEYS.TWILIO_API_KEY_SECRET, e.target.value)}
              placeholder="Your API key secret"
              aria-required="true"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="twilio-twiml-app" className="form-label">
              TwiML App SID <span aria-hidden="true">*</span>
            </label>
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", margin: "0 0 6px" }}>
              Create a TwiML App at Twilio Console → Voice → TwiML Apps. Set the Voice Request URL to your deployed site: <code>https://ccapp1.netlify.app/api/voice</code>
            </p>
            <input
              id="twilio-twiml-app"
              type="text"
              className="form-input"
              value={settings[SETTING_KEYS.TWILIO_TWIML_APP_SID] || ""}
              onChange={(e) => updateSetting(SETTING_KEYS.TWILIO_TWIML_APP_SID, e.target.value)}
              placeholder="AP..."
              aria-required="true"
              autoComplete="off"
            />
          </div>
        </div>
      </section>
      )}

      {/* Gmail Settings */}
      <section aria-labelledby="gmail-heading" className="card" style={{ marginBottom: "24px" }}>
        <h3 id="gmail-heading" style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "16px", margin: "0 0 16px" }}>
          ✉️ Gmail / Google Workspace Configuration
        </h3>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "16px" }}>
          Use a{" "}
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-accent)" }}
          >
            Google App Password
          </a>{" "}
          for authentication (2FA must be enabled).
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label htmlFor="gmail-name" className="form-label">
              Sender Name
            </label>
            <input
              id="gmail-name"
              type="text"
              className="form-input"
              value={settings[SETTING_KEYS.GMAIL_SENDER_NAME] || ""}
              onChange={(e) => updateSetting(SETTING_KEYS.GMAIL_SENDER_NAME, e.target.value)}
              placeholder="Your Name"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="gmail-email" className="form-label">
              Sender Email <span aria-hidden="true">*</span>
            </label>
            <input
              id="gmail-email"
              type="email"
              className="form-input"
              value={settings[SETTING_KEYS.GMAIL_SENDER_EMAIL] || ""}
              onChange={(e) => updateSetting(SETTING_KEYS.GMAIL_SENDER_EMAIL, e.target.value)}
              placeholder="you@yourdomain.com"
              aria-required="true"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="gmail-password" className="form-label">
              App Password <span aria-hidden="true">*</span>
            </label>
            <input
              id="gmail-password"
              type="password"
              className="form-input"
              value={settings[SETTING_KEYS.GMAIL_APP_PASSWORD] || ""}
              onChange={(e) => updateSetting(SETTING_KEYS.GMAIL_APP_PASSWORD, e.target.value)}
              placeholder="16-character app password"
              aria-required="true"
              autoComplete="off"
            />
          </div>
        </div>
      </section>

      {/* Save button */}
      <div style={{ marginBottom: "48px" }}>
        <button
          className="btn btn-success"
          onClick={handleSaveSettings}
          disabled={saving}
          style={{ width: "100%", fontSize: "1rem", padding: "14px" }}
        >
          {saving ? "Saving..." : "Save All Settings"}
        </button>
      </div>

      {/* Email Templates */}
      <section aria-labelledby="templates-heading">
        <h3 id="templates-heading" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "24px" }}>
          Email Templates
        </h3>

        {/* Create template */}
        <div className="card" style={{ marginBottom: "24px" }}>
          <h4 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "16px", margin: "0 0 16px" }}>
            Create New Template
          </h4>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "16px" }}>
            Merge fields: {"{{first_name}}"}, {"{{last_name}}"}, {"{{company}}"}, {"{{casual_name}}"}, {"{{city}}"}, {"{{state}}"}, {"{{email}}"}, {"{{phone}}"}, {"{{website}}"}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label htmlFor="tpl-name" className="form-label">
                Template Name
              </label>
              <input
                id="tpl-name"
                type="text"
                className="form-input"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g. Initial Outreach"
              />
            </div>

            <div>
              <label htmlFor="tpl-subject" className="form-label">
                Subject Line
              </label>
              <input
                id="tpl-subject"
                type="text"
                className="form-input"
                value={newTemplateSubject}
                onChange={(e) => setNewTemplateSubject(e.target.value)}
                placeholder="e.g. Quick question about {{casual_name}}"
              />
            </div>

            <div>
              <label htmlFor="tpl-body" className="form-label">
                Email Body
              </label>
              <textarea
                id="tpl-body"
                className="form-input"
                value={newTemplateBody}
                onChange={(e) => setNewTemplateBody(e.target.value)}
                rows={6}
                placeholder="Hi {{first_name}},\n\nI noticed..."
                style={{ resize: "vertical" }}
              />
            </div>

            <button className="btn btn-primary" onClick={handleCreateTemplate}>
              Create Template
            </button>
          </div>
        </div>

        {/* Existing templates */}
        {templates.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "24px" }}>
            No email templates yet. Create one above.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="Email templates">
            {templates.map((template) => (
              <li
                key={template.id}
                className="card"
                style={{ marginBottom: "12px" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h4 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 4px" }}>
                      {template.name}
                    </h4>
                    <p style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", margin: "0 0 4px" }}>
                      Subject: {template.subject}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", margin: 0, whiteSpace: "pre-wrap" }}>
                      {template.body.length > 150 ? template.body.slice(0, 150) + "..." : template.body}
                    </p>
                  </div>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDeleteTemplate(template.id, template.name)}
                    aria-label={`Delete template ${template.name}`}
                    style={{ fontSize: "0.75rem", padding: "6px 12px", flexShrink: 0 }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Keybindings */}
      <section aria-labelledby="keybindings-heading" style={{ marginTop: "48px" }}>
        <h3 id="keybindings-heading" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "24px" }}>
          ⌨️ Keybindings
        </h3>
        <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "16px" }}>
          Click &quot;Rebind&quot; and press a new key combination to change a shortcut. Changes are saved automatically.
        </p>

        <div style={{ marginBottom: "16px" }}>
          <button
            className="btn btn-secondary"
            onClick={async () => {
              setCustomBindings({});
              // Save empty bindings
              const updated = { ...settings };
              updated[KEYBINDINGS_SETTING_KEY] = JSON.stringify({});
              await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updated),
              });
              setSettings(updated);
              announce("All keybindings reset to defaults");
              setStatus("Keybindings reset to defaults");
            }}
            style={{ fontSize: "0.8125rem", padding: "8px 16px" }}
          >
            Reset All to Defaults
          </button>
        </div>

        {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => {
          const bindings = DEFAULT_KEYBINDINGS.filter((kb) => kb.category === catKey);
          if (bindings.length === 0) return null;
          return (
            <div key={catKey} className="card" style={{ marginBottom: "16px" }}>
              <h4 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 12px", color: "var(--color-accent)" }}>
                {catLabel}
              </h4>
              {bindings.map((kb) => (
                <div
                  key={kb.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--color-border)",
                    gap: "12px",
                  }}
                >
                  <div style={{ flex: "1 1 auto" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{kb.label}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{kb.description}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    {rebindingId === kb.id ? (
                      <kbd
                        tabIndex={0}
                        autoFocus
                        onKeyDown={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const keyStr = eventToKeyString(e.nativeEvent);
                          if (!keyStr) return;
                          const newBindings = { ...customBindings, [kb.id]: keyStr };
                          setCustomBindings(newBindings);
                          setRebindingId(null);
                          // Persist
                          const updated = { ...settings };
                          updated[KEYBINDINGS_SETTING_KEY] = JSON.stringify(newBindings);
                          await fetch("/api/settings", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(updated),
                          });
                          setSettings(updated);
                          announce(`${kb.label} rebound to ${keyStr}`);
                          setStatus(`${kb.label} rebound to ${keyStr}`);
                        }}
                        onBlur={() => setRebindingId(null)}
                        style={{
                          padding: "6px 14px",
                          background: "var(--color-accent)",
                          color: "#000",
                          borderRadius: "6px",
                          fontSize: "0.8125rem",
                          fontWeight: 700,
                          border: "2px solid var(--color-accent)",
                          cursor: "default",
                          animation: "pulse 1s infinite",
                        }}
                        aria-label={`Press a key combination to rebind ${kb.label}`}
                      >
                        Press keys...
                      </kbd>
                    ) : (
                      <>
                        <kbd style={{
                          padding: "4px 10px",
                          background: "var(--color-bg-tertiary)",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}>
                          {formatKeyDisplay(getKey(kb.id))}
                        </kbd>
                        <button
                          className="btn btn-secondary"
                          onClick={() => setRebindingId(kb.id)}
                          style={{ fontSize: "0.7rem", padding: "4px 8px", minHeight: "28px", minWidth: "auto" }}
                          aria-label={`Rebind ${kb.label}, currently ${formatKeyDisplay(getKey(kb.id))}`}
                        >
                          Rebind
                        </button>
                        {customBindings[kb.id] && (
                          <button
                            className="btn btn-danger"
                            onClick={async () => {
                              const newBindings = { ...customBindings };
                              delete newBindings[kb.id];
                              setCustomBindings(newBindings);
                              const updated = { ...settings };
                              updated[KEYBINDINGS_SETTING_KEY] = JSON.stringify(newBindings);
                              await fetch("/api/settings", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(updated),
                              });
                              setSettings(updated);
                              announce(`${kb.label} reset to default ${kb.defaultKey}`);
                            }}
                            style={{ fontSize: "0.65rem", padding: "2px 6px", minHeight: "24px", minWidth: "auto" }}
                            aria-label={`Reset ${kb.label} to default`}
                          >
                            ✕
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}
