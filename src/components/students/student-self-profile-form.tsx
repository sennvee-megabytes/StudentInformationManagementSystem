"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

type StudentProfile = {
  id: string;
  studentNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  sex: "MALE" | "FEMALE";
  birthDate: string | Date;
  contactNumber: string | null;
  address: string | null;
  personalEmail: string | null;
  guardianName: string | null;
  guardianContact: string | null;
  yearLevel: number;
  enrollmentStatus: string;
  program: { code: string; name: string };
  section: { name: string; schoolYear: string } | null;
};

export function StudentSelfProfileForm({ profile }: { profile: StudentProfile }) {
  const router = useRouter();
  const [contactNumber, setContactNumber] = useState(profile.contactNumber ?? "");
  const [personalEmail, setPersonalEmail] = useState(profile.personalEmail ?? "");
  const [address, setAddress] = useState(profile.address ?? "");
  const [guardianName, setGuardianName] = useState(profile.guardianName ?? "");
  const [guardianContact, setGuardianContact] = useState(profile.guardianContact ?? "");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaved(false);
    setLoading(true);

    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactNumber: contactNumber.trim() || null,
          personalEmail: personalEmail.trim() || null,
          address: address.trim() || null,
          guardianName: guardianName.trim() || null,
          guardianContact: guardianContact.trim() || null,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? "Failed to update contact information.");
        if (body.error?.fieldErrors) {
          setFieldErrors(body.error.fieldErrors);
        }
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error while saving profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Official Academic & Identity Record (Read-Only)
          </h2>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            Managed by Registrar
          </span>
        </div>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-slate-500">Student Number</dt>
            <dd className="mt-0.5 font-mono font-semibold text-slate-900">
              {profile.studentNumber}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Full Name</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {profile.lastName}, {profile.firstName} {profile.middleName ?? ""}{" "}
              {profile.suffix ?? ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Sex & Birth Date</dt>
            <dd className="mt-0.5 text-slate-900">
              {profile.sex} · {new Date(profile.birthDate).toISOString().slice(0, 10)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Program / Course</dt>
            <dd className="mt-0.5 text-slate-900">
              {profile.program.code} – {profile.program.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Year Level & Section</dt>
            <dd className="mt-0.5 text-slate-900">
              Year {profile.yearLevel} ·{" "}
              {profile.section
                ? `${profile.program.code} ${profile.yearLevel}-${profile.section.name}`
                : "Unassigned"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Enrollment Status</dt>
            <dd className="mt-0.5 font-medium text-emerald-700">{profile.enrollmentStatus}</dd>
          </div>
        </dl>
      </section>

      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
      >
        <h2 className="text-sm font-semibold text-slate-900">
          Contact & Guardian Information (Editable)
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          You may update your personal contact details and emergency guardian information below.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            {error}
          </div>
        )}
        {saved && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
            Your contact information has been updated.
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="contactNumber" className="block text-xs font-medium text-slate-700">
              Mobile Number (PH Format)
            </label>
            <input
              id="contactNumber"
              placeholder="09171234567"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
            {fieldErrors.contactNumber?.[0] && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.contactNumber[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="personalEmail" className="block text-xs font-medium text-slate-700">
              Personal Email Address
            </label>
            <input
              id="personalEmail"
              type="email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
            {fieldErrors.personalEmail?.[0] && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.personalEmail[0]}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="address" className="block text-xs font-medium text-slate-700">
              Residential Address
            </label>
            <input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
            {fieldErrors.address?.[0] && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.address[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="guardianName" className="block text-xs font-medium text-slate-700">
              Guardian Full Name
            </label>
            <input
              id="guardianName"
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
            {fieldErrors.guardianName?.[0] && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.guardianName[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="guardianContact" className="block text-xs font-medium text-slate-700">
              Guardian Contact Number
            </label>
            <input
              id="guardianContact"
              placeholder="09181234567"
              value={guardianContact}
              onChange={(e) => setGuardianContact(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
            {fieldErrors.guardianContact?.[0] && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.guardianContact[0]}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {loading ? "Saving..." : "Save Contact Information"}
          </button>
        </div>
      </form>
    </div>
  );
}
