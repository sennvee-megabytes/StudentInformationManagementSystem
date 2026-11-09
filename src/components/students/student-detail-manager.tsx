"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw, Save, Trash2 } from "lucide-react";

type ProgramOption = { id: string; code: string; name: string };
type SectionOption = {
  id: string;
  programId: string;
  yearLevel: number;
  name: string;
  schoolYear: string;
  capacity: number | null;
  _count: { students: number };
};

type EnrollmentItem = {
  id: string;
  schoolYear: string;
  semester: "FIRST" | "SECOND" | "MIDYEAR";
  yearLevel: number;
  status: string;
  program: { id: string; code: string; name: string };
  section: { id: string; name: string; yearLevel: number } | null;
};

type StudentDetail = {
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
  programId: string;
  yearLevel: number;
  sectionId: string | null;
  enrollmentStatus: "ENROLLED" | "NOT_ENROLLED" | "ON_LEAVE" | "GRADUATED" | "DROPPED";
  photoKey?: string | null;
  version: number;
  deletedAt: string | Date | null;
  enrollments: EnrollmentItem[];
};

export function StudentDetailManager({
  student,
  programs,
  sections,
  isAdmin,
  basePath,
}: {
  student: StudentDetail;
  programs: ProgramOption[];
  sections: SectionOption[];
  isAdmin?: boolean;
  basePath: "/staff/students" | "/admin/students";
}) {
  const router = useRouter();
  const isoBirth = new Date(student.birthDate).toISOString().slice(0, 10);

  const [firstName, setFirstName] = useState(student.firstName);
  const [middleName, setMiddleName] = useState(student.middleName ?? "");
  const [lastName, setLastName] = useState(student.lastName);
  const [suffix, setSuffix] = useState(student.suffix ?? "");
  const [sex, setSex] = useState<"MALE" | "FEMALE">(student.sex);
  const [birthDate, setBirthDate] = useState(isoBirth);
  const [contactNumber, setContactNumber] = useState(student.contactNumber ?? "");
  const [personalEmail, setPersonalEmail] = useState(student.personalEmail ?? "");
  const [address, setAddress] = useState(student.address ?? "");
  const [guardianName, setGuardianName] = useState(student.guardianName ?? "");
  const [guardianContact, setGuardianContact] = useState(student.guardianContact ?? "");
  const [programId, setProgramId] = useState(student.programId);
  const [yearLevel, setYearLevel] = useState(student.yearLevel);
  const [sectionId, setSectionId] = useState(student.sectionId ?? "");
  const [enrollmentStatus, setEnrollmentStatus] = useState(student.enrollmentStatus);

  // Term enrollment form
  const [termSchoolYear, setTermSchoolYear] = useState("2026-2027");
  const [termSemester, setTermSemester] = useState<"FIRST" | "SECOND" | "MIDYEAR">("FIRST");

  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoKey, setPhotoKey] = useState<string | null>(student.photoKey ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSavedMessage(null);
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/students/${student.id}/photo`, {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? "Failed to upload file to Neon Object Storage.");
        return;
      }
      setPhotoKey(body.data.key);
      setSavedMessage("Student photo / document uploaded to Neon Object Storage.");
      router.refresh();
    } catch {
      setError("Network error while uploading file.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleViewPhoto() {
    setError(null);
    const res = await fetch(`/api/students/${student.id}/photo`);
    const body = await res.json();
    if (!res.ok || !body.data?.url) {
      setError(body.error?.message ?? "Could not generate presigned URL.");
      return;
    }
    window.open(body.data.url, "_blank", "noopener,noreferrer");
  }

  const matchingSections = sections.filter(
    (s) => s.programId === programId && s.yearLevel === Number(yearLevel)
  );

  async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setConflict(false);
    setSavedMessage(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          enrollmentStatus,
          version: student.version,
        }),
      });

      const body = await res.json();
      if (res.status === 409 && body.error?.code === "VERSION_CONFLICT") {
        setConflict(true);
        setError(body.error.message);
        return;
      }
      if (!res.ok) {
        setError(body.error?.message ?? "Failed to update student profile.");
        return;
      }

      setSavedMessage("Student profile updated.");
      router.refresh();
    } catch {
      setError("Network error while saving profile.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordEnrollment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/students/${student.id}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          yearLevel: Number(yearLevel),
          sectionId: sectionId || null,
          schoolYear: termSchoolYear.trim(),
          semester: termSemester,
          status: enrollmentStatus,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? "Failed to record term enrollment.");
        return;
      }
      setSavedMessage(`Enrollment recorded for ${termSchoolYear} (${termSemester}).`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleSoftDelete() {
    if (!confirm(`Soft-delete student record ${student.studentNumber}?`)) return;
    setLoading(true);
    const res = await fetch(`/api/students/${student.id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      router.push(basePath);
      router.refresh();
    } else {
      const body = await res.json();
      setError(body.error?.message ?? "Delete failed.");
    }
  }

  async function handleRestore() {
    setLoading(true);
    const res = await fetch(`/api/students/${student.id}/restore`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json();
      setError(body.error?.message ?? "Restore failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold text-emerald-700">
            Student No. {student.studentNumber} · Record v{student.version}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold text-slate-900">
            {student.lastName}, {student.firstName}
          </h1>
        </div>

        {isAdmin && (
          <div>
            {student.deletedAt ? (
              <button
                type="button"
                onClick={handleRestore}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Restore Record
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSoftDelete}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" /> Soft Delete
              </button>
            )}
          </div>
        )}
      </div>

      {conflict && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <span>
              This record was modified by another user since you opened it (optimistic lock
              conflict).
            </span>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-amber-800 px-3 py-1 font-medium text-white hover:bg-amber-900"
          >
            Reload Latest
          </button>
        </div>
      )}

      {error && !conflict && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {savedMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {savedMessage}
        </div>
      )}

      <form
        onSubmit={handleSaveProfile}
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
      >
        <h2 className="text-sm font-semibold text-slate-900">Profile & Academic Placement</h2>

        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">First Name</label>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Middle Name</label>
            <input
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Last Name</label>
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Suffix</label>
            <input
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Sex</label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value as "MALE" | "FEMALE")}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Birth Date</label>
            <input
              type="date"
              required
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Mobile Number</label>
            <input
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Personal Email</label>
            <input
              type="email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Guardian Name</label>
            <input
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Guardian Contact</label>
            <input
              value={guardianContact}
              onChange={(e) => setGuardianContact(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">Program</label>
            <select
              value={programId}
              onChange={(e) => {
                setProgramId(e.target.value);
                setSectionId("");
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} – {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Year Level</label>
            <select
              value={yearLevel}
              onChange={(e) => {
                setYearLevel(Number(e.target.value));
                setSectionId("");
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {[1, 2, 3, 4, 5, 6].map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Section</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Unassigned —</option>
              {matchingSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.schoolYear}) – {s._count.students}/{s.capacity ?? "∞"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Enrollment Status</label>
            <select
              value={enrollmentStatus}
              onChange={(e) =>
                setEnrollmentStatus(
                  e.target.value as
                    | "ENROLLED"
                    | "NOT_ENROLLED"
                    | "ON_LEAVE"
                    | "GRADUATED"
                    | "DROPPED"
                )
              }
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ENROLLED">Enrolled</option>
              <option value="NOT_ENROLLED">Not Enrolled</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="GRADUATED">Graduated</option>
              <option value="DROPPED">Dropped</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100">
              {uploadingPhoto ? "Uploading..." : "Upload ID Photo / Document (Neon Storage)"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto || !!student.deletedAt}
                className="hidden"
              />
            </label>
            {photoKey && (
              <button
                type="button"
                onClick={handleViewPhoto}
                className="font-mono text-xs font-medium text-emerald-700 underline hover:text-emerald-800"
              >
                View Stored File ({photoKey.split("/").pop()})
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !!student.deletedAt}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            Save Profile Changes
          </button>
        </div>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleRecordEnrollment}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
        >
          <h2 className="text-sm font-semibold text-slate-900">Record Term Enrollment</h2>
          <p className="mt-1 text-xs text-slate-500">
            Records or updates enrollment for the selected school year and semester using the
            program, year level, section, and status above.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">School Year</label>
              <input
                required
                value={termSchoolYear}
                onChange={(e) => setTermSchoolYear(e.target.value)}
                placeholder="2026-2027"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Semester</label>
              <select
                value={termSemester}
                onChange={(e) =>
                  setTermSemester(e.target.value as "FIRST" | "SECOND" | "MIDYEAR")
                }
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="FIRST">1st Semester</option>
                <option value="SECOND">2nd Semester</option>
                <option value="MIDYEAR">Midyear</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading || !!student.deletedAt}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Record Term Enrollment
            </button>
          </div>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900">Enrollment History</h2>
          <div className="mt-3 divide-y divide-slate-100 text-sm">
            {student.enrollments.length === 0 ? (
              <p className="py-4 text-xs text-slate-500">No term enrollments recorded yet.</p>
            ) : (
              student.enrollments.map((en) => (
                <div key={en.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="font-medium text-slate-900">
                      {en.schoolYear} · {en.semester} Semester
                    </div>
                    <div className="text-xs text-slate-500">
                      {en.program.code} – Year {en.yearLevel}
                      {en.section ? ` (Section ${en.section.name})` : ""}
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {en.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
