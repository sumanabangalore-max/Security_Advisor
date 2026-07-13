import React, { useState, useEffect } from "react";
import { UserCheck, Plus, Trash2, Shield, User, CircleDot, Key, X, Check } from "lucide-react";
import { api } from "../api";

interface UserAccount {
  username: string;
  role: "admin" | "analyst" | "viewer";
}

interface UserManagementPanelProps {
  userRole: "admin" | "analyst" | "viewer";
}

export default function UserManagementPanel({ userRole }: UserManagementPanelProps) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "analyst" | "viewer">("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [resetPasswordUser, setResetPasswordUser] = useState<string | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const canEdit = userRole === "admin";

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await api.get<UserAccount[]>("/api/v1/users");
      setUsers(data);
    } catch {
      setError("Failed to fetch user list.");
    }
  };

  const handleResetPassword = async (username: string) => {
    if (!canEdit || resetLoading) return;
    setResetLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.post(`/api/v1/users/${username}/reset-password`, {
        password: newPasswordValue
      });
      setSuccess(`Password for user "${username}" has been successfully updated!`);
      setResetPasswordUser(null);
      setNewPasswordValue("");
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || loading) return;
    setError("");
    setSuccess("");

    if (!newUsername.trim()) {
      setError("Username cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<{ status: string; users: UserAccount[] }>("/api/v1/users", {
        username: newUsername.trim(),
        role: newRole,
      });
      setUsers(res.users);
      setNewUsername("");
      setNewRole("viewer");
      setSuccess("User account created successfully! Password matches username.");
    } catch (err: any) {
      setError(err.message || "Failed to create user account.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (!canEdit || loading) return;
    if (confirm(`Are you sure you want to remove user "${username}"?`)) {
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        const res = await api.delete<{ status: string; users: UserAccount[] }>(`/api/v1/users/${username}`);
        setUsers(res.users);
        setSuccess(`Successfully deleted user "${username}".`);
      } catch (err: any) {
        setError(err.message || "Failed to remove user account.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleUpdateRole = async (username: string, role: "admin" | "analyst" | "viewer") => {
    if (!canEdit || loading) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.patch<{ status: string; users: UserAccount[] }>(`/api/v1/users/${username}/role`, { role });
      setUsers(res.users);
      setSuccess(`Updated role for "${username}" to ${role}.`);
    } catch (err: any) {
      setError(err.message || "Failed to update role.");
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-500/10 text-red-400 border border-red-500/20";
      case "analyst":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      default:
        return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    }
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-[#121214] p-5 space-y-6 shadow-md" id="user-management-panel">
      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded bg-emerald-600/10 p-1.5 text-emerald-400">
            <UserCheck className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Access & Role Controls</h3>
            <p className="text-[11px] text-zinc-500">Manage directory users, privileges, and analyst assignments</p>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-400 font-mono bg-red-500/5 p-2 rounded border border-red-500/15">{error}</p>}
      {success && <p className="text-xs text-emerald-400 font-mono bg-emerald-500/5 p-2 rounded border border-emerald-500/15">{success}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* User Directory List */}
        <div className="lg:col-span-8 space-y-3">
          <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <CircleDot className="h-3 w-3 text-emerald-400" />
            Active User Directory
          </h4>

          <div className="overflow-hidden rounded border border-zinc-850 bg-zinc-950/20">
            <table className="w-full text-left border-collapse" id="users-table">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/40 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Access Level</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30 text-xs text-zinc-300">
                {users.map((u) => (
                  <tr key={u.username} className="hover:bg-zinc-900/10 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <div className="rounded bg-zinc-800 p-1 text-zinc-400">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        {u.username}
                      </div>
                    </td>
                    {resetPasswordUser === u.username ? (
                      <td className="px-4 py-3 text-right" colSpan={2}>
                        <div className="flex items-center justify-end gap-2 animate-in slide-in-from-right-1 duration-150">
                          <span className="text-[10px] text-zinc-500 font-medium">New Password:</span>
                          <input
                            type="text"
                            value={newPasswordValue}
                            onChange={(e) => setNewPasswordValue(e.target.value)}
                            placeholder="Leave empty to use username"
                            className="bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-emerald-500 w-44"
                          />
                          <button
                            onClick={() => handleResetPassword(u.username)}
                            disabled={resetLoading}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded p-1 cursor-pointer flex items-center justify-center transition-colors"
                            title="Confirm Password Reset"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setResetPasswordUser(null);
                              setNewPasswordValue("");
                            }}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded p-1 cursor-pointer flex items-center justify-center transition-colors"
                            title="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          {canEdit ? (
                            <select
                              value={u.role}
                              onChange={(e) => handleUpdateRole(u.username, e.target.value as any)}
                              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-zinc-300 focus:outline-none cursor-pointer uppercase tracking-wider"
                            >
                              <option value="admin">Administrator</option>
                              <option value="analyst">Analyst</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase border ${getRoleBadgeColor(u.role)}`}>
                              {u.role}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canEdit ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setResetPasswordUser(u.username);
                                  setNewPasswordValue("");
                                }}
                                className="text-zinc-500 hover:text-emerald-400 p-1 rounded hover:bg-zinc-900 transition-all cursor-pointer"
                                title="Reset Password"
                              >
                                <Key className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.username)}
                                disabled={users.length <= 1}
                                className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-900 transition-all cursor-pointer disabled:opacity-30"
                                title="Delete User"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Read Only</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create User panel */}
        <div className="lg:col-span-4">
          <div className="rounded-lg border border-zinc-800 bg-[#0a0a0c] p-4 space-y-4">
            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-800 pb-2">
              <Plus className="h-3.5 w-3.5 text-emerald-400" />
              Provision Account
            </h4>

            {canEdit ? (
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter unique username..."
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Default Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 focus:border-zinc-500 focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="viewer">Viewer (Read Only)</option>
                    <option value="analyst">Analyst (Edit, Ingest, Remediation)</option>
                    <option value="admin">Administrator (All Operations)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] font-bold text-white py-2 px-3 uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create User
                </button>

                <p className="text-[9px] text-zinc-500 leading-normal border-t border-zinc-800 pt-2">
                  <span className="font-bold text-zinc-400 block mb-0.5">Note on passwords:</span>
                  To streamline credentials in Sandbox environments, new users authenticate using their <strong>Username</strong> as their initial password.
                </p>
              </form>
            ) : (
              <div className="text-center py-6 text-zinc-500 text-[11px] leading-relaxed">
                <Shield className="h-6 w-6 text-zinc-700 mx-auto mb-2" />
                Only Administrator accounts can provision new users or edit access control bindings.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
