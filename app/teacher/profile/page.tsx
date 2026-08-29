import { getCurrentUser } from "@/lib/auth/session";
import { getIdentityReadRepository } from "@/lib/identity-read";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function TeacherProfilePage() {
  const user = await getCurrentUser();
  const teacher = await (await getIdentityReadRepository()).getTeacherProfile();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Profile</h2>
        <p className="mt-1 text-sm text-foreground/65">
          Keep the details used on your dashboard and examination papers up to date.
        </p>
      </div>
      <ProfileForm
        email={user?.email ?? ""}
        name={teacher?.name ?? ""}
        school={teacher?.school ?? ""}
        phone={teacher?.phone ?? ""}
      />
    </div>
  );
}
