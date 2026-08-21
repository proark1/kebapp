import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";
import { PasswordResetForm } from "@/components/auth/password-reset-form";
import { RegistrationForm } from "@/components/auth/registration-form";
import {
  loginFormSchema,
  registrationFormSchema,
  safeInternalPathSchema,
} from "@/lib/auth-form-schema";
import type { AuthFormAction } from "@/lib/auth-form-state";
import {
  choosePostLoginDestination,
  chooseSafeContinueDestination,
} from "@/lib/post-login-destination";

const idleAction: AuthFormAction = async () => ({
  message: "",
  status: "idle",
});

function submitButtonForm(name: string): void {
  const button = screen.getByRole("button", { name });
  fireEvent.submit(button.closest("form")!);
}

describe("Kebapp authentication forms", () => {
  it("supplements server validation with browser constraints", () => {
    render(<RegistrationForm action={idleAction} />);

    const email = screen.getByLabelText("E-Mail-Adresse");
    const password = screen.getByLabelText("Passwort");
    const confirmation = screen.getByLabelText("Passwort wiederholen");

    expect(email).toHaveAttribute("type", "email");
    expect(email).toBeRequired();
    expect(password).toHaveAttribute("minlength", "12");
    expect(password).toHaveAttribute("maxlength", "128");
    expect(confirmation).toHaveAttribute("autocomplete", "new-password");
  });

  it("rejects malformed server input and unsafe continuation paths", () => {
    expect(
      loginFormSchema.safeParse({
        continueTo: "https://example.com/fremd",
        email: "keine-mail",
        password: "kurz",
      }).success,
    ).toBe(false);
    expect(safeInternalPathSchema.safeParse("//example.com").success).toBe(
      false,
    );
    expect(safeInternalPathSchema.safeParse("/app/website").success).toBe(
      true,
    );
    expect(
      registrationFormSchema.safeParse({
        confirmPassword: "Anderes-Passwort-2026",
        email: "inhaber@example.com",
        name: "Ada Betreiberin",
        password: "Sicheres-Passwort-2026",
      }).success,
    ).toBe(false);
  });

  it("shows understandable field and form errors returned by the server", async () => {
    const action: AuthFormAction = async () => ({
      fieldErrors: {
        email: "Bitte gib eine gültige E-Mail-Adresse ein.",
      },
      message: "Bitte prüfe die markierten Felder.",
      status: "error",
    });

    render(<LoginForm action={action} />);
    fireEvent.change(screen.getByLabelText("E-Mail-Adresse"), {
      target: { value: "inhaber@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Passwort"), {
      target: { value: "Sicheres-Passwort-2026" },
    });
    submitButtonForm("Sicher anmelden");

    expect(
      await screen.findByText("Bitte prüfe die markierten Felder."),
    ).toHaveAttribute("role", "alert");
    expect(
      screen.getByText("Bitte gib eine gültige E-Mail-Adresse ein."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("E-Mail-Adresse")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("disables the login submitter and explains the pending state", async () => {
    let resolveAction: ((value: Awaited<ReturnType<AuthFormAction>>) => void) | undefined;
    const action = vi.fn<AuthFormAction>(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(<LoginForm action={action} />);
    fireEvent.change(screen.getByLabelText("E-Mail-Adresse"), {
      target: { value: "inhaber@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Passwort"), {
      target: { value: "Sicheres-Passwort-2026" },
    });
    submitButtonForm("Sicher anmelden");

    const pendingButton = await screen.findByRole("button", {
      name: "Anmeldung läuft …",
    });
    expect(pendingButton).toBeDisabled();
    expect(action).toHaveBeenCalledOnce();

    await act(async () => {
      resolveAction?.({ message: "", status: "idle" });
    });
  });

  it("renders the same neutral password-reset success for every address", async () => {
    const action: AuthFormAction = async () => ({
      message:
        "Wenn ein Konto zu dieser Adresse gehört, ist ein Link zum Zurücksetzen unterwegs.",
      status: "success",
    });

    render(<PasswordResetForm action={action} mode="request" />);
    const form = screen.getByRole("button", { name: "Link anfordern" }).closest(
      "form",
    )!;
    fireEvent.change(within(form).getByLabelText("E-Mail-Adresse"), {
      target: { value: "unbekannt@example.com" },
    });
    fireEvent.submit(form);

    expect(
      await screen.findByText(
        "Wenn ein Konto zu dieser Adresse gehört, ist ein Link zum Zurücksetzen unterwegs.",
      ),
    ).toHaveAttribute("role", "status");
  });

  it("routes actors by platform role and Kebapp status", () => {
    const baseFacts = {
      accountStatus: "ACTIVE" as const,
      membershipStatuses: [] as const,
      platformRoles: [] as const,
      registrationRequestCount: 0,
    };

    expect(choosePostLoginDestination(baseFacts)).toBe("/antrag");
    expect(
      choosePostLoginDestination({
        ...baseFacts,
        registrationRequestCount: 1,
      }),
    ).toBe("/status");
    expect(
      choosePostLoginDestination({
        ...baseFacts,
        membershipStatuses: ["ACTIVE"],
      }),
    ).toBe("/app");
    expect(
      choosePostLoginDestination({
        ...baseFacts,
        membershipStatuses: ["ACTIVE", "ACTIVE"],
      }),
    ).toBe("/app/organisation-waehlen");
    expect(
      choosePostLoginDestination({
        ...baseFacts,
        platformRoles: ["ADMIN"],
      }),
    ).toBe("/admin");
    expect(
      choosePostLoginDestination({
        ...baseFacts,
        platformRoles: ["SUPPORT"],
      }),
    ).toBe("/support");
  });

  it("keeps continuation paths inside the actor's authorized area", () => {
    expect(
      chooseSafeContinueDestination(
        "/app",
        "/app/website?bereich=farben",
      ),
    ).toBe("/app/website?bereich=farben");
    expect(
      chooseSafeContinueDestination("/app", "/app/../admin"),
    ).toBe("/app");
    expect(
      chooseSafeContinueDestination("/app", "https://example.com/app"),
    ).toBe("/app");
    expect(chooseSafeContinueDestination("/antrag", "/app")).toBe(
      "/antrag",
    );
  });
});
