export type AuthenticatedUser = Readonly<{
  id: string;
  email: string | null;
}>;
