import "server-only";

import { withAuthenticatedTransaction } from "../db/postgres-client.ts";
import type { TeacherProfileUpdate, TeacherProfileWriteRepository } from "./contracts.ts";

export class PostgresTeacherProfileWriteRepository implements TeacherProfileWriteRepository {
  private readonly userId: string;
  constructor(userId: string) { this.userId = userId; }

  async updateProfile(profile: TeacherProfileUpdate): Promise<void> {
    await withAuthenticatedTransaction(this.userId, (client) => client.query(
      `update public.teachers
          set name = $2::text, school = $3::text, phone = $4::text
        where user_id = $1::uuid`,
      [this.userId, profile.name, profile.school, profile.phone]
    ));
  }
}
