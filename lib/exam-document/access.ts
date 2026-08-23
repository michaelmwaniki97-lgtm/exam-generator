export function mayAccessExam(role: "teacher" | "admin" | null, requesterTeacherId: string | null, ownerTeacherId: string): boolean {
  return role === "admin" || (role === "teacher" && requesterTeacherId !== null && requesterTeacherId === ownerTeacherId);
}
