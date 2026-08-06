import React, { useState, useEffect } from "react";
import { UserCheck, Plus, Trash2, Shield, User, CircleDot, Key, X, Check, Lock, Layers } from "lucide-react";
import { api } from "../api";
import { UserRole } from "../types";

interface UserAccount {
  username: string;
  role: UserRole;
}

interface UserManagementPanelProps {
  userRole: UserRole;
}

export default function UserManagementPanel({ userRole }: UserManagementPanelProps) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("viewer");
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

  const handleUpdateRole = async (username: string, role: UserRole) => {
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
        return "bg-red-500/10 text-red-600 border border-red-500/20";
      case "patch_manager":
        return "bg-purple-500/10 text-purple-700 border border-purple-500/20";
      case "eos_manager":
        return "bg-sky-500/10 text-sky-700 border border-sky-500/20";
      case "vuln_manager":
        return "bg-rose-500/10 text-rose-700 border border-rose-500/20";
      case "analyst":
        return "bg-amber-500/10 text-amber-700 border border-amber-500/20";
      default:
        return "bg-slate-500/10 text-slate-700 border border-slate-500/20";
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 shadow-xs" id="user-management-panel">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 border border-indigo-100">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Access & Role Controls</h3>
            <p className="text-xs text-slate-500">Manage directory users, privileges, and analyst assignments</p>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 font-mono bg-red-50 p-2.5 rounded-lg border border-red-200">{error}</p>}
      {success && <p className="text-xs text-emerald-700 font-mono bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">{success}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* User Directory List */}
        <div className="lg:col-span-8 space-y-3">
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <CircleDot className="h-3.5 w-3.5 text-indigo-600" />
            Active User Directory
          </h4>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left border-collapse" id="users-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Access Level</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                {users.map((u) => (
                  <tr key={u.username} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="rounded-lg bg-indigo-50 p-1.5 text-indigo-600 border border-indigo-100">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        {u.username}
                      </div>
                    </td>
                    {resetPasswordUser === u.username ? (
                      <td className="px-4 py-3 text-right" colSpan={2}>
                        <div className="flex items-center justify-end gap-2 animate-in slide-in-from-right-1 duration-150">
                          <span className="text-[11px] text-slate-500 font-medium">New Password:</span>
                          <input
                            type="text"
                            value={newPasswordValue}
                            onChange={(e) => setNewPasswordValue(e.target.value)}
                            placeholder="Leave empty to use username"
                            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 w-44"
                          />
                          <button
                            onClick={() => handleResetPassword(u.username)}
                            disabled={resetLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg p-1.5 cursor-pointer flex items-center justify-center transition-colors shadow-xs"
                            title="Confirm Password Reset"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setResetPasswordUser(null);
                              setNewPasswordValue("");
                            }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg p-1.5 cursor-pointer flex items-center justify-center transition-colors"
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
                              className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer uppercase tracking-wider"
                            >
                              <option value="admin">Administrator</option>
                              <option value="patch_manager">Patch Manager</option>
                              <option value="eos_manager">EOS/EOL Manager</option>
                              <option value="vuln_manager">Vulnerability Manager</option>
                              <option value="analyst">Analyst</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${getRoleBadgeColor(u.role)}`}>
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
                                className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                                title="Reset Password"
                              >
                                <Key className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.username)}
                                disabled={users.length <= 1}
                                className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-30"
                                title="Delete User"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Read Only</span>
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
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200 pb-3">
              <Plus className="h-4 w-4 text-indigo-600" />
              Provision Account
            </h4>

            {canEdit ? (
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter unique username..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Default Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="viewer">Viewer (Read Only Overview & Inventory)</option>
                    <option value="patch_manager">Patch Manager (Patch Tracker Page Only)</option>
                    <option value="eos_manager">EOS/EOL Manager (EOS/EOL Tracker Page Only)</option>
                    <option value="vuln_manager">Vulnerability Manager (Vulnerability & Zero-Day Pages)</option>
                    <option value="analyst">Analyst (Edit, Ingest & Operations)</option>
                    <option value="admin">Administrator (All Operations & Settings)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white py-2.5 px-4 uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  Create User Account
                </button>

                <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-200 pt-3">
                  <span className="font-bold text-slate-700 block mb-0.5">Note on credentials:</span>
                  To streamline onboarding in Sandbox environments, new users authenticate using their <strong>Username</strong> as their initial password.
                </p>
              </form>
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs leading-relaxed">
                <Shield className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                Only Administrator accounts can provision new users or edit access control bindings.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
