export type AuthenticatedUser = Readonly<{
  id: string;
  email: string | null;
}>;

export type CredentialSignupInput = Readonly<{
  name: string;
  email: string;
  password: string;
  school: string;
  phone: string;
}>;

export type CredentialLoginInput = Readonly<{
  email: string;
  password: string;
}>;

export type CredentialSignupResult =
  | { status: "signed-in"; user: AuthenticatedUser }
  | { status: "confirmation-required" }
  | { status: "error"; error: string };

export type CredentialLoginResult =
  | { status: "signed-in"; user: AuthenticatedUser; sessionToken: string | null }
  | { status: "error"; error: string };
