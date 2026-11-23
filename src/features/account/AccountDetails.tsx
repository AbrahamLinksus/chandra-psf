import type { User } from "@/domain/types";

const ROLE_LABELS: Record<User["role"], string> = {
  support: "Support",
  branch_admin: "Branch admin",
  main_admin: "Main admin",
};

export function AccountDetails({ user }: { user: User }) {
  const rows: [string, string][] = [
    ["Name", user.name],
    ["Email", user.email],
    ["Role", ROLE_LABELS[user.role]],
    ["Branch", user.branchName ?? "All branches"],
  ];
  return (
    <section
      aria-labelledby="details-heading"
      className="grid gap-3 rounded-2xl border bg-card p-4"
    >
      <h2 id="details-heading" className="text-lg font-semibold">
        Your details
      </h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
