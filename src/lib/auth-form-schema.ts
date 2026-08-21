import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Bitte gib eine gültige E-Mail-Adresse ein.")
  .max(320, "Die E-Mail-Adresse ist zu lang.");

const password = z
  .string()
  .min(12, "Das Passwort muss mindestens 12 Zeichen haben.")
  .max(128, "Das Passwort darf höchstens 128 Zeichen haben.");

export const safeInternalPathSchema = z
  .string()
  .max(2_048)
  .refine(
    (value) =>
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("\\") &&
      !value.includes("\0"),
    "Ungültiges Weiterleitungsziel.",
  );

export const loginFormSchema = z.object({
  continueTo: safeInternalPathSchema.optional(),
  email,
  password,
});

export const registrationFormSchema = z
  .object({
    confirmPassword: password,
    email,
    name: z
      .string()
      .trim()
      .min(2, "Bitte gib deinen Namen ein.")
      .max(160, "Der Name ist zu lang."),
    password,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Die Passwörter stimmen nicht überein.",
    path: ["confirmPassword"],
  });

export const emailOnlyFormSchema = z.object({ email });

export const resetPasswordFormSchema = z
  .object({
    confirmPassword: password,
    password,
    token: z.string().min(10).max(4_096),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Die Passwörter stimmen nicht überein.",
    path: ["confirmPassword"],
  });
