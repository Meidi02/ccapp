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
  accountSid: string;
  assignedTo?: { username: string } | null;
  createdAt: string;
};

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [twilioNumbers, setTwilioNumbers] = useState<TwilioNumber[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");

  const [newPhone, setNewPhone] = useState("");
  const [newSid, setNewSid] = useState("");
  const [newToken, setNewToken] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [twilioError, setTwilioError] = useState("");

  const router = useRouter();

  useEffect(() => {
    Promise.all([fetchUsers(), fetchTwilioNumbers()]).finally(() => setLoading(false));
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
      const res = await fetch("/api/admin/twilio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          phoneNumber: newPhone, 
          accountSid: newSid, 
          authToken: newToken,
          assignedToId: assignUserId || null
        }),
      });
      if (res.ok) {
        setNewPhone("");
        setNewSid("");
        setNewToken("");
        setAssignUserId("");
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
        <div className="md:col-span-1">
          <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-orange-400">Add Twilio Number</h2>
            {twilioError && <p className="text-red-500 mb-4 text-sm">{twilioError}</p>}
            <form onSubmit={handleAddTwilioNumber} className="space-y-4">
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
              <div>
                <label className="block text-sm text-gray-400 mb-1">Assign to Child</label>
                <select
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  <option value="">-- Unassigned --</option>
                  {users.filter(u => u.role === 'CHILD').map(u => (
                    <option key={u.id} value={u.id}>{u.username}</option>
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
                      <td className="px-6 py-4 font-medium">{num.phoneNumber}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-400">{num.accountSid}</td>
                      <td className="px-6 py-4">
                        {num.assignedTo ? (
                          <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-semibold">
                            {num.assignedTo.username}
                          </span>
                        ) : (
                          <span className="text-gray-500 italic">Unassigned</span>
                        )}
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
    </div>
  );
}
