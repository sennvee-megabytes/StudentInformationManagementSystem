"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { TempPasswordDialog } from "@/components/admin/temp-password-dialog";

type ProgramOption = {
  id: string;
  code: string;
  name: string;
};

type SectionOption = {
  id: string;
  programId: string;
  yearLevel: number;
  name: string;
  schoolYear: string;
  capacity: number | null;
  _count: { students: number };
};

export function StudentRegistrationForm({
  programs,
  sections,
  basePath,
}: {
  programs: ProgramOption[];
  sections: SectionOption[];
  basePath: "/staff/students" | "/admin/students";
}) {
  const router = useRouter();
  const [studentNumber, setStudentNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [sex, setSex] = useState<"MALE" | "FEMALE">("MALE");
  const [birthDate, setBirthDate] = useState("2006-05-15");
  const [contactNumber, setContactNumber] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [address, setAddress] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [yearLevel, setYearLevel] = useState(1);
  const [sectionId, setSectionId] = useState<string>("");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [semester, setSemester] = useState<"FIRST" | "SECOND" | "MIDYEAR">("FIRST");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<{
    studentId: string;
    username: string;
    temporaryPassword: string;
  } | null>(null);

  const availableSections = sections.filter(
    (s) => s.programId === programId && s.yearLevel === Number(yearLevel)
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentNumber: studentNumber.trim(),
          firstName: firstName.trim(),
          middleName: middleName.trim() || null,
          lastName: lastName.trim(),
          suffix: suffix.trim() || null,
          sex,
          birthDate,
          contactNumber: contactNumber.trim() || null,
          personalEmail: personalEmail.trim() || null,
          address: address.trim() || null,
          guardianName: guardianName.trim() || null,
          guardianContact: guardianContact.trim() || null,
          programId,
          yearLevel: Number(yearLevel),
          sectionId: sectionId || null,
          schoolYear: schoolYear.trim(),
          semester,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? "Failed to register student.");
        if (body.error?.fieldErrors) {
          setFieldErrors(body.error.fieldErrors);
        }
        return;
      }

      setCreatedAccount({
        studentId: body.data.id,
        username: body.data.account.username,
        temporaryPassword: body.data.account.temporaryPassword,
      });
    } catch {
      setError("Network error while registering student.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {createdAccount && (
        <TempPasswordDialog
          title="Student Registered & Account Provisioned"
          username={createdAccount.username}
          temporaryPassword={createdAccount.temporaryPassword}
          onClose={() => {
            router.push(`${basePath}/${createdAccount.studentId}`);
            router.refresh();
          }}
        />
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900">1. Personal Information</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="studentNumber" className="block text-xs font-medium text-slate-700">
                Student Number *
              </label>
              <input
                id="studentNumber"
                required
                placeholder="e.g. 202612345"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-emerald-600 focus:outline-none"
              />
              {fieldErrors.studentNumber?.[0] && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.studentNumber[0]}</p>
              )}
            </div>
            <div>
              <label htmlFor="firstName" className="block text-xs font-medium text-slate-700">
                First Name *
              </label>
              <input
                id="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="middleName" className="block text-xs font-medium text-slate-700">
                Middle Name
              </label>
              <input
                id="middleName"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-xs font-medium text-slate-700">
                Last Name *
              </label>
              <input
                id="lastName"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="suffix" className="block text-xs font-medium text-slate-700">
                Suffix
              </label>
              <input
                id="suffix"
                placeholder="Jr., III"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="sex" className="block text-xs font-medium text-slate-700">
                Sex *
              </label>
              <select
                id="sex"
                value={sex}
                onChange={(e) => setSex(e.target.value as "MALE" | "FEMALE")}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div>
              <label htmlFor="birthDate" className="block text-xs font-medium text-slate-700">
                Birth Date *
              </label>
              <input
                id="birthDate"
                type="date"
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
              {fieldErrors.birthDate?.[0] && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.birthDate[0]}</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900">2. Contact & Guardian Details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="contactNumber" className="block text-xs font-medium text-slate-700">
                Mobile Number
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
                Personal Email
              </label>
              <input
                id="personalEmail"
                type="email"
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="address" className="block text-xs font-medium text-slate-700">
                Residential Address
              </label>
              <input
                id="address"
                placeholder="Indang, Cavite"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
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
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900">
            3. Initial Program, Year Level, Section & Term Placement
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-5">
            <div className="sm:col-span-2">
              <label htmlFor="programId" className="block text-xs font-medium text-slate-700">
                Program / Course *
              </label>
              <select
                id="programId"
                required
                value={programId}
                onChange={(e) => {
                  setProgramId(e.target.value);
                  setSectionId("");
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              >
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} – {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="yearLevel" className="block text-xs font-medium text-slate-700">
                Year Level *
              </label>
              <select
                id="yearLevel"
                value={yearLevel}
                onChange={(e) => {
                  setYearLevel(Number(e.target.value));
                  setSectionId("");
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              >
                {[1, 2, 3, 4, 5, 6].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="sectionId" className="block text-xs font-medium text-slate-700">
                Assigned Section
              </label>
              <select
                id="sectionId"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              >
                <option value="">— Unassigned —</option>
                {availableSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name} ({sec.schoolYear}) – {sec._count.students}/{sec.capacity ?? "∞"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="schoolYear" className="block text-xs font-medium text-slate-700">
                School Year *
              </label>
              <input
                id="schoolYear"
                required
                placeholder="2026-2027"
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="semester" className="block text-xs font-medium text-slate-700">
                Semester *
              </label>
              <select
                id="semester"
                value={semester}
                onChange={(e) => setSemester(e.target.value as "FIRST" | "SECOND" | "MIDYEAR")}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              >
                <option value="FIRST">1st Semester</option>
                <option value="SECOND">2nd Semester</option>
                <option value="MIDYEAR">Midyear</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push(basePath)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || programs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-5 py-2.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {loading ? "Registering..." : "Register Student & Provision Account"}
          </button>
        </div>
      </form>
    </>
  );
}
