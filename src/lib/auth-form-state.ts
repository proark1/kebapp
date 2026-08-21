export type AuthFieldName =
  | "confirmPassword"
  | "email"
  | "name"
  | "password";

export type AuthFormState = {
  fieldErrors?: Partial<Record<AuthFieldName, string>>;
  message: string;
  status: "error" | "idle" | "success";
};

export type AuthFormAction = (
  previousState: AuthFormState,
  formData: FormData,
) => Promise<AuthFormState>;

export const initialAuthFormState: AuthFormState = {
  message: "",
  status: "idle",
};
