export type AdminReviewState = {
  message: string;
  status: "error" | "idle";
};

export type AdminReviewAction = (
  previousState: AdminReviewState,
  formData: FormData,
) => Promise<AdminReviewState>;

export const initialAdminReviewState: AdminReviewState = {
  message: "",
  status: "idle",
};
