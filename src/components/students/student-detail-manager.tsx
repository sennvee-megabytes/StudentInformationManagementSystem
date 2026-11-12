"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookOpen, Plus, RotateCcw, Save, Sparkles, Trash2 } from "lucide-react";
import { ALL_PRESET_SUBJECTS } from "@/lib/curriculum";

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

type AcademicRecordItem = {
  id: string;
  schoolYear: string;
  semester: "FIRST" | "SECOND" | "MIDYEAR";
  subjectCode: string;
  subjectTitle: string;
  units: number;
  grade: string | null;
  remarks: string | null;
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
  academicRecords?: AcademicRecordItem[];
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

  // Academic subject registration / grade encoding form
  const [acadSchoolYear, setAcadSchoolYear] = useState("2026-2027");
  const [acadSemester, setAcadSemester] = useState<"FIRST" | "SECOND" | "MIDYEAR">("FIRST");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectTitle, setSubjectTitle] = useState("");
  const [units, setUnits] = useState("3.0");
  const [grade, setGrade] = useState("");
  const [remarks, setRemarks] = useState("ENROLLED");

  // Inline editing state for academic records
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editGrade, setEditGrade] = useState("");
  const [editRemarks, setEditRemarks] = useState("");

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

  async function handleAddAcademicRecord(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/students/${student.id}/academic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolYear: acadSchoolYear.trim(),
          semester: acadSemester,
          subjectCode: subjectCode.trim().toUpperCase(),
          subjectTitle: subjectTitle.trim(),
          units: Number(units),
          grade: grade.trim() || null,
          remarks: remarks.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? "Failed to register academic subject.");
        return;
      }
      setSubjectCode("");
      setSubjectTitle("");
      setUnits("3.0");
      setGrade("");
      setRemarks("ENROLLED");
      setSavedMessage("Academic subject registered for student.");
      router.refresh();
    } catch {
      setError("Network error while registering academic subject.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateAcademicRecord(recordId: string) {
    setError(null);
    setSavedMessage(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/students/${student.id}/academic/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: editGrade.trim() || null,
          remarks: editRemarks.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? "Failed to update subject grade/remarks.");
        return;
      }
      setEditingRecordId(null);
      setSavedMessage("Subject grade and remarks updated.");
      router.refresh();
    } catch {
      setError("Network error while updating subject record.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAcademicRecord(recordId: string, code: string) {
    if (!confirm(`Remove subject ${code} from this student's academic records?`)) return;
    setError(null);
    setSavedMessage(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/students/${student.id}/academic/${recordId}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? "Failed to remove academic subject.");
        return;
      }
      setSavedMessage(`Removed subject ${code}.`);
      router.refresh();
    } catch {
      setError("Network error while removing subject record.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadCurriculum() {
    setError(null);
    setSavedMessage(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/students/${student.id}/academic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loadCurriculum: true,
          schoolYear: acadSchoolYear.trim(),
          semester: acadSemester,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? "Failed to load curriculum subjects.");
        return;
      }
      const added = body.data?.addedCount ?? 0;
      setSavedMessage(
        added > 0
          ? `Loaded ${added} standard curriculum subject(s) for ${acadSchoolYear} (${acadSemester}).`
          : `All standard curriculum subjects for ${acadSchoolYear} (${acadSemester}) are already registered.`
      );
      router.refresh();
    } catch {
      setError("Network error while loading curriculum subjects.");
    } finally {
      setLoading(false);
    }
  }

  const academicRecords = student.academicRecords ?? [];

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

      {/* Academic Subject Registration & Grade Encoding */}
      <div
        id="academic-records"
        className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Academic Subjects, Units & Grade Encoding
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Register subjects for the student&apos;s term and encode or update grades and remarks.
              Subjects added here appear immediately in the Student Portal under Academic Records.
            </p>
          </div>
          <button
            type="button"
            disabled={loading || !!student.deletedAt}
            onClick={handleLoadCurriculum}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Load Standard Curriculum ({acadSchoolYear} · {acadSemester})
          </button>
        </div>

        <form
          onSubmit={handleAddAcademicRecord}
          className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-12"
        >
          <div className="sm:col-span-12">
            <label className="block text-xs font-medium text-slate-700">
              Quick Select CEIT Subject (Optional — auto-fills Code, Title & Units)
            </label>
            <select
              value=""
              onChange={(e) => {
                const found = ALL_PRESET_SUBJECTS.find((s) => s.subjectCode === e.target.value);
                if (found) {
                  setSubjectCode(found.subjectCode);
                  setSubjectTitle(found.subjectTitle);
                  setUnits(String(found.units));
                }
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value="">— Choose a CEIT curriculum subject or type custom below —</option>
              {ALL_PRESET_SUBJECTS.map((s) => (
                <option key={s.subjectCode} value={s.subjectCode}>
                  {s.subjectCode} — {s.subjectTitle} ({s.units.toFixed(1)} units)
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700">School Year</label>
            <input
              required
              value={acadSchoolYear}
              onChange={(e) => setAcadSchoolYear(e.target.value)}
              placeholder="2026-2027"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700">Semester</label>
            <select
              value={acadSemester}
              onChange={(e) =>
                setAcadSemester(e.target.value as "FIRST" | "SECOND" | "MIDYEAR")
              }
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value="FIRST">1st Semester</option>
              <option value="SECOND">2nd Semester</option>
              <option value="MIDYEAR">Midyear</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700">Subject Code</label>
            <input
              required
              value={subjectCode}
              onChange={(e) => setSubjectCode(e.target.value)}
              placeholder="e.g. ITEC 50"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs uppercase"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-slate-700">Descriptive Title</label>
            <input
              required
              value={subjectTitle}
              onChange={(e) => setSubjectTitle(e.target.value)}
              placeholder="e.g. Web Systems and Technologies"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-slate-700">Units</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="12"
              required
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-slate-700">Grade</label>
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="1.25 / —"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-slate-700">Remarks</label>
            <input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="ENROLLED"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            />
          </div>
          <div className="flex items-end justify-end sm:col-span-12">
            <button
              type="submit"
              disabled={loading || !!student.deletedAt}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              Register Subject
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Term</th>
                <th className="px-3 py-2.5">Subject Code</th>
                <th className="px-3 py-2.5">Descriptive Title</th>
                <th className="px-3 py-2.5">Units</th>
                <th className="px-3 py-2.5">Grade</th>
                <th className="px-3 py-2.5">Remarks</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {academicRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No subjects registered yet. Use the form above to register subjects and encode
                    grades for this student.
                  </td>
                </tr>
              ) : (
                academicRecords.map((rec) => {
                  const isEditing = editingRecordId === rec.id;
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 text-slate-600">
                        {rec.schoolYear} · {rec.semester}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-900">
                        {rec.subjectCode}
                      </td>
                      <td className="px-3 py-2.5 text-slate-800">{rec.subjectTitle}</td>
                      <td className="px-3 py-2.5 text-slate-700">{Number(rec.units).toFixed(1)}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">
                        {isEditing ? (
                          <input
                            value={editGrade}
                            onChange={(e) => setEditGrade(e.target.value)}
                            placeholder="e.g. 1.50"
                            className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                        ) : (
                          rec.grade ?? "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {isEditing ? (
                          <input
                            value={editRemarks}
                            onChange={(e) => setEditRemarks(e.target.value)}
                            placeholder="PASSED / ENROLLED"
                            className="w-32 rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                        ) : (
                          rec.remarks ?? "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => handleUpdateAcademicRecord(rec.id)}
                              className="rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-800"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRecordId(null)}
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={!!student.deletedAt}
                              onClick={() => {
                                setEditingRecordId(rec.id);
                                setEditGrade(rec.grade ?? "");
                                setEditRemarks(rec.remarks ?? "");
                              }}
                              className="font-medium text-emerald-700 hover:underline disabled:opacity-50"
                            >
                              Edit Grade
                            </button>
                            <button
                              type="button"
                              disabled={loading || !!student.deletedAt}
                              onClick={() => handleDeleteAcademicRecord(rec.id, rec.subjectCode)}
                              className="font-medium text-red-600 hover:underline disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
