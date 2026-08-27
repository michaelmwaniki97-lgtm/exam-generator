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

export type PasswordResetRequestInput = Readonly<{
  email: string;
}>;

export type PasswordResetRequestResult =
  | { status: "accepted" }
  | { status: "error"; error: string };

export type PasswordResetCompletionInput = Readonly<{
  newPassword: string;
  token: string | null;
}>;

export type PasswordResetCompletionResult =
  | { status: "updated" }
  | { status: "invalid-link" }
  | { status: "error"; error: string };
