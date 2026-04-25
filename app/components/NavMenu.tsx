"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

type User = {
  userId: string;
  username: string;
  role: string;
};

type Project = {
  id: string;
  name: string;
};

export default function NavMenu({ user }: { user: User | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  useEffect(() => {
    // When activeProjectId changes, save it to local storage
    if (activeProjectId) {
      localStorage.setItem("activeProjectId", activeProjectId);
      // Trigger a custom event to notify other components (like leads list)
      window.dispatchEvent(new Event('projectChanged'));
    }
  }, [activeProjectId]);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        const stored = localStorage.getItem("activeProjectId");
        if (stored && data.find((p: Project) => p.id === stored)) {
          setActiveProjectId(stored);
        } else if (data.length > 0) {
          setActiveProjectId(data[0].id);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  if (!user || pathname === "/login") return null;

  return (
    <nav aria-label="Main navigation">
      <div
        className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-900 flex-wrap gap-4"
      >
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-extrabold text-blue-500 m-0">CCAPP</h1>
          
          <div className="flex items-center gap-2 bg-gray-800 rounded-md p-1 border border-gray-700">
            <label htmlFor="project-select" className="sr-only">Select Project</label>
            <select
              id="project-select"
              value={activeProjectId}
              onChange={(e) => setActiveProjectId(e.target.value)}
              className="bg-transparent text-gray-200 text-sm py-1 px-2 focus:outline-none cursor-pointer"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id} className="bg-gray-800">{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/" className={`px-3 py-1.5 rounded text-sm transition ${pathname === "/" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>Dashboard</Link>
          <Link href="/history" className={`px-3 py-1.5 rounded text-sm transition ${pathname === "/history" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>History</Link>
          <Link href="/texts" className={`px-3 py-1.5 rounded text-sm transition ${pathname === "/texts" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>Texts</Link>
          <Link href="/metrics" className={`px-3 py-1.5 rounded text-sm transition ${pathname === "/metrics" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>Metrics</Link>
          <Link href="/settings" className={`px-3 py-1.5 rounded text-sm transition ${pathname === "/settings" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>Settings</Link>
          
          {user.role === 'MASTER' && (
            <Link href="/admin" className={`px-3 py-1.5 rounded text-sm transition font-semibold ${pathname === "/admin" ? "bg-purple-600 text-white" : "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"}`}>Admin</Link>
          )}
          
          <button onClick={handleLogout} className="px-3 py-1.5 rounded text-sm transition bg-red-500/20 text-red-400 hover:bg-red-500/30 ml-2">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
