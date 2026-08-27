export type TeacherProfileUpdate = {
  name: string;
  school: string | null;
  phone: string | null;
};

export interface TeacherProfileWriteRepository {
  updateProfile(profile: TeacherProfileUpdate): Promise<void>;
}
