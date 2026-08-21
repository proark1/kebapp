export type RegistrationFieldName =
  | "city"
  | "contactEmail"
  | "contactName"
  | "contactPhone"
  | "legalName"
  | "postalCode"
  | "storeName"
  | "street";

export type RegistrationFormState = {
  fieldErrors?: Partial<Record<RegistrationFieldName, string>>;
  message: string;
  status: "error" | "idle";
};

export type RegistrationFormAction = (
  previousState: RegistrationFormState,
  formData: FormData,
) => Promise<RegistrationFormState>;

export const initialRegistrationFormState: RegistrationFormState = {
  message: "",
  status: "idle",
};
