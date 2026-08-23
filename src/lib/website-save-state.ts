export type WebsiteSaveState = {
  fieldLabels?: string[];
  message?: string;
  status: "idle" | "error";
};

export const initialWebsiteSaveState: WebsiteSaveState = { status: "idle" };
