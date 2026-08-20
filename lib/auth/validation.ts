export const AUTH_INPUT_LIMITS = {
  name: 100,
  email: 254,
  password: 128,
  school: 160,
  phone: 30,
} as const;

export type SignupFields = {
  name: string;
  email: string;
  password: string;
  school: string;
  phone: string;
};

export function validateSignupFields(fields: SignupFields): string | null {
  if (fields.name.length < 2) return "Please enter your full name.";
  if (fields.name.length > AUTH_INPUT_LIMITS.name) {
    return `Name must be ${AUTH_INPUT_LIMITS.name} characters or fewer.`;
  }
  if (!fields.email) return "Please enter your email.";
  if (fields.email.length > AUTH_INPUT_LIMITS.email) {
    return "Email address is too long.";
  }
  if (fields.password.length < 6) {
    return "Password must be at least 6 characters long.";
  }
  if (fields.password.length > AUTH_INPUT_LIMITS.password) {
    return `Password must be ${AUTH_INPUT_LIMITS.password} characters or fewer.`;
  }
  if (fields.school.length > AUTH_INPUT_LIMITS.school) {
    return `School must be ${AUTH_INPUT_LIMITS.school} characters or fewer.`;
  }
  if (fields.phone.length > AUTH_INPUT_LIMITS.phone) {
    return `Phone number must be ${AUTH_INPUT_LIMITS.phone} characters or fewer.`;
  }
  return null;
}

export function validateLoginFields({
  email,
  password,
}: Pick<SignupFields, "email" | "password">): string | null {
  if (!email || !password) return "Please enter your email and password.";
  if (
    email.length > AUTH_INPUT_LIMITS.email ||
    password.length > AUTH_INPUT_LIMITS.password
  ) {
    return "The login details are too long.";
  }
  return null;
}
