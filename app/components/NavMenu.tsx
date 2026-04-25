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

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

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

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });

      if (res.ok) {
        const newProject = await res.json();
        setProjects([...projects, newProject]);
        setActiveProjectId(newProject.id);
        setIsCreatingProject(false);
        setNewProjectName("");
      } else {
        alert("Failed to create project");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating project");
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
    <>
      <nav aria-label="Main navigation">
        <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-900 flex-wrap gap-4">
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
            <button 
              onClick={() => setIsCreatingProject(true)}
              className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 px-2 py-1 rounded transition border border-gray-600"
              title="Create New Project"
            >
              +
            </button>
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

      {isCreatingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700 w-full max-w-sm">
            <h2 className="text-xl font-bold text-white mb-4">Create New Project</h2>
            <form onSubmit={handleCreateProject}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Project Name</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="e.g., Q3 Tech Leads"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingProject(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition text-sm font-medium"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
