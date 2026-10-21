"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Role, User } from "@/lib/types";
import { Badge, Button, Card, ErrorNote, Field, Input, LoadingBlock, Modal, PageHeader, Select } from "@/components/ui";

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "admin", label: "Admin", description: "Full access, settings and users" },
  { value: "hr", label: "HR / Recruiter", description: "Manage candidates, events and roles" },
  { value: "viewer", label: "Viewer / Approver", description: "Read-only access" },
];

export default function UsersPage() {
  const { isAdmin, user: me } = useAuth();
  const { data, error, loading, reload } = useApi<User[]>(isAdmin ? "/api/users" : null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState("");

  if (!isAdmin) return <ErrorNote message="Only admins can manage users." />;

  async function update(id: number, body: Partial<User> & { password?: string }) {
    setActionError("");
    try {
      await api(`/api/users/${id}`, { method: "PATCH", json: body });
      reload(true);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Who can sign in to the recruitment dashboard."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Add user
          </Button>
        }
      />
      <div className="mb-4">
        <ErrorNote message={error || actionError} />
      </div>
      <Card className="overflow-hidden">
        {loading && !data ? (
          <LoadingBlock />
        ) : (
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      className="w-44 py-1 text-xs"
                      value={u.role}
                      disabled={u.id === me?.id}
                      onChange={(e) => update(u.id, { role: e.target.value as Role })}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.is_active ? "green" : "slate"}>{u.is_active ? "Active" : "Disabled"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const password = prompt(`New password for ${u.name} (min 8 characters)`);
                          if (password) update(u.id, { password });
                        }}
                      >
                        Reset password
                      </Button>
                      {u.id !== me?.id && (
                        <Button size="sm" variant="ghost" onClick={() => update(u.id, { is_active: !u.is_active })}>
                          {u.is_active ? "Disable" : "Enable"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload(true);
          }}
        />
      )}
    </>
  );
}

function CreateUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", role: "hr" as Role, password: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/users", { method: "POST", json: form });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add user">
      <form onSubmit={save} className="space-y-4">
        <ErrorNote message={error} />
        <Field label="Name" required>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email" required>
          <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label} – {r.description}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Temporary password" required hint="At least 8 characters">
          <Input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Create user
          </Button>
        </div>
      </form>
    </Modal>
  );
}
