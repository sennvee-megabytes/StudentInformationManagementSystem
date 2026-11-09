import { requirePageRole } from "@/lib/authz";
import { profileService } from "@/server/services/profile";
import { StudentSelfProfileForm } from "@/components/students/student-self-profile-form";

export default async function StudentProfilePage() {
  const session = await requirePageRole(["STUDENT"]);
  const profile = await profileService.getOwnProfile(session);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          View your official student information and keep your contact details up to date.
        </p>
      </div>
      <StudentSelfProfileForm profile={profile} />
    </div>
  );
}
