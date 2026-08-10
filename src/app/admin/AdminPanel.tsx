"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  FileStack,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";
import {
  Button,
  Input,
  Label,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Modal,
  Spinner,
} from "@/components/ui";
import { useToast } from "@/components/ToastProvider";
import { cn } from "@/lib/utils";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLES,
  type Role,
} from "@/lib/permissions";
import { api } from "@/lib/client";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

interface Totals {
  users: number;
  companies: number;
  boards: number;
  posts: number;
}

interface Stats {
  totals: Totals;
  byRole: Record<string, number>;
}

interface Settings {
  inviteCode: string;
  signupsOpen: boolean;
}

const ROLE_TONE: Record<Role, string> = {
  admin: "bg-brand-500/12 text-brand-300 border-brand-500/30",
  owner: "bg-sky-500/12 text-sky-300 border-sky-500/30",
  designer: "bg-violet-500/12 text-violet-300 border-violet-500/30",
  content_creator: "bg-emerald-500/12 text-emerald-300 border-emerald-500/30",
};

export default function AdminPanel({
  currentUser,
  initialUsers,
  initialStats,
  initialSettings,
}: {
  currentUser: { id: string; email: string; name: string; role: Role };
  initialUsers: AdminUser[];
  initialStats: Stats;
  initialSettings: Settings;
}) {
  const [tab, setTab] = useState<"overview" | "users" | "settings">("overview");
  const [stats, setStats] = useState<Stats>(initialStats);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const notify = useToast();

  async function refreshStats() {
    const data = await api<Stats>("/api/admin/stats");
    setStats(data);
  }

  return (
    <div className="surface min-h-dvh">
      <header className="border-b border-[var(--line)] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link
            href="/"
            className="text-muted hover:text-body grid size-9 place-items-center rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
            aria-label="Back to workspace"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <span className="brand-gradient grid size-9 place-items-center rounded-[10px] text-base font-black text-white">
            X
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-bold">Admin console</p>
            <p className="text-dim truncate text-[11px]">
              {currentUser.email} · {ROLE_LABELS[currentUser.role]}
            </p>
          </div>
        </div>
      </header>

      <nav className="mx-auto flex max-w-6xl gap-1 border-b border-[var(--line)] px-4 sm:px-6">
        {([
          ["overview", "Overview"],
          ["users", "Users"],
          ["settings", "Signup"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "relative px-3 py-3 text-sm font-medium transition-colors",
              tab === key ? "text-body" : "text-muted hover:text-body",
            )}
          >
            {label}
            {tab === key && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500" />
            )}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {tab === "overview" && <Overview stats={stats} />}
        {tab === "users" && (
          <Users
            users={initialUsers}
            currentUser={currentUser}
            onChanged={() => {
              void refreshStats();
            }}
            notify={notify}
          />
        )}
        {tab === "settings" && (
          <SignupSettings settings={settings} onSave={setSettings} notify={notify} />
        )}
      </main>
    </div>
  );
}

// ------------------------------------------------------------------ overview

function Overview({ stats }: { stats: Stats }) {
  const cards = [
    { label: "Users", value: stats.totals.users, icon: <UsersIcon className="size-4" /> },
    { label: "Companies", value: stats.totals.companies, icon: <Building2 className="size-4" /> },
    { label: "Sheets", value: stats.totals.boards, icon: <FileStack className="size-4" /> },
    { label: "Posts", value: stats.totals.posts, icon: <FileStack className="size-4" /> },
  ];
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="text-dim flex items-center gap-2 text-[11px] font-bold tracking-wide uppercase">
              {c.icon}
              {c.label}
            </div>
            <p className="tabular mt-2 text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Roles</h2>
        <p className="text-muted mt-0.5 text-xs">
          How many people hold each permission level.
        </p>
        <div className="mt-4 space-y-3">
          {ROLES.map((role) => (
            <div key={role} className="flex items-center gap-3">
              <span
                className={cn(
                  "inline-flex w-36 shrink-0 items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  ROLE_TONE[role],
                )}
              >
                {ROLE_LABELS[role]}
              </span>
              <span className="text-muted flex-1 text-xs">
                {ROLE_DESCRIPTIONS[role]}
              </span>
              <span className="tabular text-sm font-bold">
                {stats.byRole[role] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// -------------------------------------------------------------------- users

function Users({
  users,
  currentUser,
  onChanged,
  notify,
}: {
  users: AdminUser[];
  currentUser: { id: string };
  onChanged: () => void;
  notify: (msg: string, tone?: "ok" | "error") => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [list, setList] = useState<AdminUser[]>(users);

  function apply(updated: AdminUser) {
    setList((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  }
  function remove(id: string) {
    setList((prev) => prev.filter((u) => u.id !== id));
  }
  function add(created: AdminUser) {
    setList((prev) => [...prev, created]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Team members</h2>
          <p className="text-muted mt-0.5 text-xs">
            Create accounts and grant roles. Permissions apply the moment you save.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" /> Add user
        </Button>
      </div>

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[1.5fr_2fr_1fr_auto] gap-3 border-b border-[var(--line)] px-4 py-2.5 text-[10px] font-bold tracking-wide text-[var(--text-dim)] uppercase sm:grid">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span />
        </div>
        {list.map((u) => (
          <div
            key={u.id}
            className="grid grid-cols-1 gap-2 border-b border-[var(--line)] px-4 py-3 last:border-0 sm:grid-cols-[1.5fr_2fr_1fr_auto] sm:items-center sm:gap-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{u.name || "—"}</p>
              <p className="text-dim text-[11px]">
                Joined {u.createdAt.slice(0, 10)}
              </p>
            </div>
            <p className="text-muted truncate text-xs">{u.email}</p>
            <span
              className={cn(
                "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                ROLE_TONE[u.role],
              )}
            >
              {ROLE_LABELS[u.role]}
            </span>
            <div className="flex justify-end">
              <Menu
                align="end"
                trigger={
                  <MenuTrigger muted>
                    <span>Manage</span>
                  </MenuTrigger>
                }
              >
                <MenuItem icon={<Pencil className="size-3.5" />} onClick={() => setEditing(u)}>
                  Edit role & name
                </MenuItem>
                <MenuItem
                  icon={<KeyRound className="size-3.5" />}
                  onClick={() => setEditing({ ...u })}
                  keepOpen
                >
                  Reset password
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  danger
                  icon={<Trash2 className="size-3.5" />}
                  disabled={u.id === currentUser.id}
                  onClick={async () => {
                    const res = await fetch(`/api/admin/users/${u.id}`, {
                      method: "DELETE",
                    });
                    if (!res.ok) {
                      const d = await res.json().catch(() => ({}));
                      notify(d.error ?? "Couldn't delete user", "error");
                      return;
                    }
                    remove(u.id);
                    onChanged();
                    notify("User deleted");
                  }}
                >
                  {u.id === currentUser.id ? "Can't delete yourself" : "Delete user"}
                </MenuItem>
              </Menu>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-dim px-4 py-10 text-center text-sm">No users yet.</p>
        )}
      </div>

      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onCreated={(u) => {
            add(u);
            onChanged();
            notify("User created");
          }}
          notify={notify}
        />
      )}
      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={(u) => {
            apply(u);
            onChanged();
            notify("Saved");
          }}
          notify={notify}
        />
      )}
    </div>
  );
}

function CreateUserModal({
  onClose,
  onCreated,
  notify,
}: {
  onClose: () => void;
  onCreated: (u: AdminUser) => void;
  notify: (msg: string, tone?: "ok" | "error") => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("content_creator");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create user");
      onCreated(data.user);
      onClose();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add user"
      description="Create an account and assign a role."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy && <Spinner />} Create
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sara" />
        </label>
        <label className="grid gap-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="sara@company.com"
          />
        </label>
        <label className="grid gap-1.5">
          <Label>Password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </label>
        <RolePicker value={role} onChange={setRole} />
      </div>
    </Modal>
  );
}

function EditUserModal({
  user,
  onClose,
  onSaved,
  notify,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: (u: AdminUser) => void;
  notify: (msg: string, tone?: "ok" | "error") => void;
}) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { name, role };
      if (password) body.password = password;
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save");
      onSaved(data.user);
      onClose();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit user"
      description={user.email}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy && <Spinner />} Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <RolePicker value={role} onChange={setRole} />
        <label className="grid gap-1.5">
          <Label>Reset password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep current"
          />
        </label>
      </div>
    </Modal>
  );
}

function RolePicker({
  value,
  onChange,
}: {
  value: Role;
  onChange: (r: Role) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>Role</Label>
      <Menu
        className="w-full"
        trigger={
          <MenuTrigger className="h-9">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-brand-400" />
              {ROLE_LABELS[value]}
            </span>
          </MenuTrigger>
        }
      >
        <MenuLabel>Permission level</MenuLabel>
        {ROLES.map((r) => (
          <MenuItem key={r} selected={r === value} onClick={() => onChange(r)}>
            <span className="flex flex-col">
              <span>{ROLE_LABELS[r]}</span>
              <span className="text-dim text-[11px] font-normal">
                {ROLE_DESCRIPTIONS[r]}
              </span>
            </span>
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}

// ----------------------------------------------------------------- settings

function SignupSettings({
  settings,
  onSave,
  notify,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  notify: (msg: string, tone?: "ok" | "error") => void;
}) {
  const [inviteCode, setInviteCode] = useState(settings.inviteCode);
  const [signupsOpen, setSignupsOpen] = useState(settings.signupsOpen);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode, signupsOpen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save");
      onSave({ inviteCode: data.inviteCode, signupsOpen: data.signupsOpen });
      notify("Settings saved");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card max-w-xl space-y-5 p-5">
      <div>
        <h2 className="text-sm font-semibold">Self-registration</h2>
        <p className="text-muted mt-0.5 text-xs">
          Control whether teammates can create their own accounts with an invite code.
        </p>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-medium">Allow sign-ups</span>
          <span className="text-muted text-xs">
            When off, only you can create accounts from the Users tab.
          </span>
        </span>
        <Toggle checked={signupsOpen} onChange={setSignupsOpen} />
      </label>

      <label className="grid gap-1.5">
        <Label>Invite code</Label>
        <Input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="Leave empty to clear"
        />
        <span className="text-dim text-[11px]">
          People you invite will enter this on the sign-up screen.
        </span>
      </label>

      <div className="flex justify-end">
        <Button variant="primary" onClick={() => void save()} disabled={busy}>
          {busy && <Spinner />} Save settings
        </Button>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-ring",
        checked ? "bg-brand-500" : "bg-[var(--surface-hover)]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
