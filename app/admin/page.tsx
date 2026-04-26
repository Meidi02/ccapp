"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  username: string;
  role: string;
  createdAt: string;
  _count: { projects: number };
};

type TwilioNumber = {
  id: string;
  phoneNumber: string;
  nickname?: string | null;
  accountSid: string;
  assignedToId?: string | null;
  assignedTo?: { username: string } | null;
  createdAt: string;
};

type TwilioProfile = {
  id: string;
  name: string;
  accountSid: string;
  authToken: string;
};

type SystemLog = {
  id: string;
  level: string;
  source: string;
  message: string;
  meta: any;
  createdAt: string;
};

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [twilioNumbers, setTwilioNumbers] = useState<TwilioNumber[]>([]);
  const [twilioProfiles, setTwilioProfiles] = useState<TwilioProfile[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");

  const [newPhone, setNewPhone] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [newSid, setNewSid] = useState("");
  const [newToken, setNewToken] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [twilioError, setTwilioError] = useState("");

  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [saveProfile, setSaveProfile] = useState(false);
  const [profileName, setProfileName] = useState("");

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  const router = useRouter();

  useEffect(() => {
    Promise.all([fetchUsers(), fetchTwilioNumbers(), fetchTwilioProfiles(), fetchLogs(), fetchSettings()]).finally(() => setLoading(false));
    
    // Poll logs every 5 seconds
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else if (res.status === 403) {
        router.push("/");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTwilioNumbers = async () => {
    try {
      const res = await fetch("/api/admin/twilio");
      if (res.ok) {
        const data = await res.json();
        setTwilioNumbers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTwilioProfiles = async () => {
    try {
      const res = await fetch("/api/admin/twilio-profiles");
      if (res.ok) {
        const data = await res.json();
        setTwilioProfiles(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/admin/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data && !data.error ? data : {});
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) alert("Global Twilio settings saved!");
      else alert("Failed to save settings");
    } catch {
      alert("Failed to save settings");
    }
    setSavingSettings(false);
  };

  const handleProfileSelect = (profileId: string) => {
    setSelectedProfileId(profileId);
    if (profileId) {
      const profile = twilioProfiles.find(p => p.id === profileId);
      if (profile) {
        setNewSid(profile.accountSid);
        setNewToken(profile.authToken);
      }
    } else {
      setNewSid("");
      setNewToken("");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername, password: newPassword }),
      });
      if (res.ok) {
        setNewUsername("");
        setNewPassword("");
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to create user");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user? This will delete all their projects and leads.")) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  const handleAddTwilioNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwilioError("");
    try {
      if (saveProfile && profileName) {
        // Save profile first
        await fetch("/api/admin/twilio-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: profileName, accountSid: newSid, authToken: newToken }),
        });
        fetchTwilioProfiles();
      }

      const res = await fetch("/api/admin/twilio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          phoneNumber: newPhone, 
          nickname: newNickname,
          accountSid: newSid, 
          authToken: newToken,
          assignedToId: assignUserId || null
        }),
      });
      if (res.ok) {
        setNewPhone("");
        setNewNickname("");
        if (!selectedProfileId) {
          setNewSid("");
          setNewToken("");
        }
        setAssignUserId("");
        setSaveProfile(false);
        setProfileName("");
        fetchTwilioNumbers();
      } else {
        const data = await res.json();
        setTwilioError(data.error);
      }
    } catch (err) {
      setTwilioError("Failed to add Twilio number");
    }
  };

  const handleDeleteTwilioNumber = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Twilio number?")) return;
    try {
      const res = await fetch(`/api/admin/twilio/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchTwilioNumbers();
      } else {
        alert("Failed to delete Twilio number");
      }
    } catch (err) {
      alert("Failed to delete Twilio number");
    }
  };

  const handleUpdateAssignment = async (id: string, newAssignedToId: string) => {
    try {
      const res = await fetch(`/api/admin/twilio/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: newAssignedToId || null })
      });
      if (res.ok) fetchTwilioNumbers();
      else alert("Failed to reassign Twilio number");
    } catch (err) {
      alert("Failed to reassign Twilio number");
    }
  };

  if (loading) return <div className="p-8 text-white">Loading...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto text-gray-100">
      <h1 className="text-3xl font-bold mb-8">Master Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-blue-400">Add New User</h2>
            {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition"
              >
                Create User
              </button>
            </form>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-gray-800 rounded-lg shadow-md border border-gray-700 overflow-hidden">
            <h2 className="text-xl font-semibold p-6 border-b border-gray-700 text-blue-400">Users List</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-900 text-gray-400 text-sm">
                  <tr>
                    <th className="px-6 py-3">Username</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Projects</th>
                    <th className="px-6 py-3">Joined</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700 text-sm">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-700/50">
                      <td className="px-6 py-4 font-medium">{user.username}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${user.role === 'MASTER' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">{user._count.projects}</td>
                      <td className="px-6 py-4">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right">
                        {user.role !== 'MASTER' && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Global Twilio Settings */}
      <div className="bg-gray-800 rounded-lg shadow-md border border-gray-700 overflow-hidden mt-8">
        <h2 className="text-xl font-semibold p-6 border-b border-gray-700 text-pink-400">Global Twilio Configuration</h2>
        <div className="p-6">
          <p className="text-sm text-gray-400 mb-6">These are the master credentials used for outbound browser dialing.</p>
          <form onSubmit={handleSaveSettings} className="space-y-4 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Account SID</label>
                <input
                  type="text"
                  value={settings['TWILIO_ACCOUNT_SID'] || ""}
                  onChange={(e) => setSettings({...settings, 'TWILIO_ACCOUNT_SID': e.target.value})}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                  placeholder="AC..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Auth Token</label>
                <input
                  type="password"
                  value={settings['TWILIO_AUTH_TOKEN'] || ""}
                  onChange={(e) => setSettings({...settings, 'TWILIO_AUTH_TOKEN': e.target.value})}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">API Key SID</label>
                <input
                  type="text"
                  value={settings['TWILIO_API_KEY_SID'] || ""}
                  onChange={(e) => setSettings({...settings, 'TWILIO_API_KEY_SID': e.target.value})}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                  placeholder="SK..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">API Key Secret</label>
                <input
                  type="password"
                  value={settings['TWILIO_API_KEY_SECRET'] || ""}
                  onChange={(e) => setSettings({...settings, 'TWILIO_API_KEY_SECRET': e.target.value})}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-400 mb-1">TwiML App SID</label>
                <input
                  type="text"
                  value={settings['TWILIO_TWIML_APP_SID'] || ""}
                  onChange={(e) => setSettings({...settings, 'TWILIO_TWIML_APP_SID': e.target.value})}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                  placeholder="AP..."
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingSettings}
              className="mt-4 bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 px-6 rounded transition disabled:opacity-50"
            >
              {savingSettings ? "Saving..." : "Save Global Settings"}
            </button>
          </form>
        </div>
      </div>

      {/* Global Email-to-SMS Settings */}
      <div className="bg-gray-800 rounded-lg shadow-md border border-gray-700 overflow-hidden mt-8">
        <h2 className="text-xl font-semibold p-6 border-b border-gray-700 text-green-400">Global Email-to-SMS Configuration (Gmail)</h2>
        <div className="p-6">
          <p className="text-sm text-gray-400 mb-6">These credentials are used for the Email-to-SMS fallback when bypassing A2P 10DLC restrictions. You must use a <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google App Password</a> (requires 2FA).</p>
          <form onSubmit={handleSaveSettings} className="space-y-4 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sender Name (Optional)</label>
                <input
                  type="text"
                  value={settings['GMAIL_SENDER_NAME'] || ""}
                  onChange={(e) => setSettings({...settings, 'GMAIL_SENDER_NAME': e.target.value})}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                  placeholder="Your Name"
                />
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Gmail Address *</label>
                  <input
                    type="email"
                    value={settings['GMAIL_SENDER_EMAIL'] || ""}
                    onChange={(e) => setSettings({...settings, 'GMAIL_SENDER_EMAIL': e.target.value})}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                    placeholder="you@gmail.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">App Password *</label>
                  <input
                    type="password"
                    value={settings['GMAIL_APP_PASSWORD'] || ""}
                    onChange={(e) => setSettings({...settings, 'GMAIL_APP_PASSWORD': e.target.value})}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                    placeholder="16-character app password"
                    required
                  />
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={savingSettings}
              className="mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded transition disabled:opacity-50"
            >
              {savingSettings ? "Saving..." : "Save Global Settings"}
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
        <div className="md:col-span-1">
          <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-orange-400">Add Twilio Number</h2>
            {twilioError && <p className="text-red-500 mb-4 text-sm">{twilioError}</p>}
            <form onSubmit={handleAddTwilioNumber} className="space-y-4">
              {twilioProfiles.length > 0 && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Use Saved Profile (Optional)</label>
                  <select
                    value={selectedProfileId}
                    onChange={(e) => handleProfileSelect(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    <option value="">-- Enter credentials manually --</option>
                    {twilioProfiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+1234567890"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Nickname (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Sales Line 1"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Account SID</label>
                <input
                  type="text"
                  value={newSid}
                  onChange={(e) => setNewSid(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Auth Token</label>
                <input
                  type="password"
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>

              {!selectedProfileId && (
                <div className="bg-gray-700/30 p-3 rounded border border-gray-700">
                  <label className="flex items-center space-x-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={saveProfile}
                      onChange={(e) => setSaveProfile(e.target.checked)}
                      className="rounded bg-gray-900 border-gray-600"
                    />
                    <span>Save account credentials as a Profile</span>
                  </label>
                  {saveProfile && (
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Profile Name (e.g. Client X Burners)"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
                        required={saveProfile}
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1">Assign to User</label>
                <select
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  <option value="">-- Unassigned --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 rounded transition"
              >
                Add Number
              </button>
            </form>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700 mt-8">
            <h2 className="text-lg font-semibold mb-2 text-blue-400">Advanced: SIP Bridge</h2>
            <p className="text-sm text-gray-400 mb-4">Required for parallel dialing across different Twilio accounts. This automatically configures a SIP Domain on your Master Account.</p>
            <button
              onClick={async () => {
                try {
                  const baseUrl = window.location.origin;
                  const res = await fetch("/api/admin/sip-bridge", { 
                    method: "POST", 
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ baseUrl }) 
                  });
                  const data = await res.json();
                  if (res.ok) alert("SIP Bridge configured successfully at " + data.domainName);
                  else alert("Error: " + data.error);
                } catch (e) {
                  alert("Failed to configure SIP Bridge");
                }
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition"
            >
              Initialize SIP Bridge
            </button>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-gray-800 rounded-lg shadow-md border border-gray-700 overflow-hidden">
            <h2 className="text-xl font-semibold p-6 border-b border-gray-700 text-orange-400">Twilio Numbers</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-900 text-gray-400 text-sm">
                  <tr>
                    <th className="px-6 py-3">Phone Number</th>
                    <th className="px-6 py-3">Account SID</th>
                    <th className="px-6 py-3">Assigned To</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700 text-sm">
                  {twilioNumbers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No Twilio numbers added</td>
                    </tr>
                  )}
                  {twilioNumbers.map((num) => (
                    <tr key={num.id} className="hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        <div className="font-medium">{num.phoneNumber}</div>
                        {num.nickname && <div className="text-xs text-gray-400 mt-1">{num.nickname}</div>}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-400">{num.accountSid}</td>
                      <td className="px-6 py-4">
                        <select
                          value={num.assignedToId || ""}
                          onChange={(e) => handleUpdateAssignment(num.id, e.target.value)}
                          className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="">Unassigned</option>
                          {users.map(u => (
                            <option key={u.id} value={u.id}>{u.username}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteTwilioNumber(num.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-gray-800 rounded-lg shadow-md border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-green-400">System Logs (Live)</h2>
          <button onClick={fetchLogs} className="text-sm text-gray-400 hover:text-white transition">
            ↻ Refresh
          </button>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-gray-900 text-gray-400 sticky top-0">
              <tr>
                <th className="px-4 py-2 w-48">Timestamp</th>
                <th className="px-4 py-2 w-24">Level</th>
                <th className="px-4 py-2 w-24">Source</th>
                <th className="px-4 py-2">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-gray-500 font-sans">No system logs available</td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-700/50">
                  <td className="px-4 py-2 text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      log.level === 'ERROR' ? 'text-red-400 bg-red-400/10' :
                      log.level === 'WARN' ? 'text-yellow-400 bg-yellow-400/10' :
                      'text-blue-400 bg-blue-400/10'
                    }`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400">{log.source}</td>
                  <td className="px-4 py-2 text-gray-300">
                    <div>{log.message}</div>
                    {log.meta && (
                      <div className="mt-1 text-[10px] text-gray-500 overflow-x-hidden text-ellipsis whitespace-nowrap max-w-2xl">
                        {JSON.stringify(log.meta)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
