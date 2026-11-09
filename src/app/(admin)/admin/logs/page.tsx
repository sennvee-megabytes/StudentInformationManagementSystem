import { Download } from "lucide-react";
import { requirePageRole } from "@/lib/authz";
import { auditLogQuerySchema, auditLogService } from "@/server/services/audit-logs";

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePageRole(["ADMIN"]);
  const rawParams = await searchParams;
  const cleaned = Object.fromEntries(
    Object.entries(rawParams).filter(([, v]) => v !== "" && v !== undefined)
  );
  const query = auditLogQuerySchema.parse({ ...cleaned, format: "json" });
  const { items, meta } = await auditLogService.list(query);

  const csvParams = new URLSearchParams();
  if (query.actor) csvParams.set("actor", query.actor);
  if (query.action) csvParams.set("action", query.action);
  if (query.outcome) csvParams.set("outcome", query.outcome);
  if (query.from) csvParams.set("from", query.from);
  if (query.to) csvParams.set("to", query.to);
  csvParams.set("format", "csv");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Activity Logs</h1>
          <p className="mt-1 text-sm text-slate-600">
            Immutable, append-only audit trail of authentication events, record changes, and access
            checks ({meta.total} total events).
          </p>
        </div>

        <a
          href={`/api/audit-logs?${csvParams.toString()}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </a>
      </div>

      <form
        method="GET"
        action="/admin/logs"
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:grid-cols-6"
      >
        <div>
          <label className="block text-xs font-medium text-slate-600">Actor Username</label>
          <input
            name="actor"
            defaultValue={query.actor ?? ""}
            placeholder="e.g. admin"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Action</label>
          <input
            name="action"
            defaultValue={query.action ?? ""}
            placeholder="e.g. LOGIN_FAILURE"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Outcome</label>
          <select
            name="outcome"
            defaultValue={query.outcome ?? ""}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">From Date</label>
          <input
            name="from"
            type="date"
            defaultValue={query.from ?? ""}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">To Date</label>
          <input
            name="to"
            type="date"
            defaultValue={query.to ?? ""}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            Filter Logs
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  No activity logs match the selected filters.
                </td>
              </tr>
            ) : (
              items.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-600">
                    {new Date(log.createdAt).toLocaleString("en-PH")}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {log.actor?.username ?? "anonymous"}
                    </span>
                    {log.actorRole && (
                      <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {log.actorRole}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-900">
                    {log.action}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        log.outcome === "SUCCESS"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {log.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">
                    {log.entityType ? `${log.entityType}` : "—"}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2.5 font-mono text-xs text-slate-500">
                    {log.metadata ? JSON.stringify(log.metadata) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
