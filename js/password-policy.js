/** Shared checks for new passwords. Existing passwords remain valid for login. */
const COMMON_PASSWORDS = new Set([
  "password123", "password1234", "1234567890", "12345678901", "qwerty12345",
  "letmein1234", "iloveyou123", "abc1234567", "student1234", "vignanai123",
  "vidyanikethan1", "studyhard123", "welcome123", "admin12345",
]);

export function newPasswordProblem(value) {
  const password = String(value ?? "");
  if (password.length < 10 || password.length > 128) return "Use a password or passphrase of 10–128 characters.";
  if (COMMON_PASSWORDS.has(password.toLowerCase().trim())) return "Choose a less common password or passphrase.";
  return "";
}
