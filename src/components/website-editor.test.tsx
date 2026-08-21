import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebsiteEditor } from "@/components/website-editor";
import { demoStoreProfile } from "@/lib/demo-data";
import type { StorefrontEditorData } from "@/lib/types";

const initialData: StorefrontEditorData = {
  customDomain: null,
  isPublished: true,
  profile: demoStoreProfile,
  publicPath: "/laden/ocakbasi-rheydt-pilot",
  publicSlug: "ocakbasi-rheydt-pilot",
};

function createSaveAction() {
  return vi.fn<(formData: FormData) => Promise<void>>(async () => undefined);
}

describe("WebsiteEditor", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders injected database data without local storage", () => {
    render(
      <WebsiteEditor initialData={initialData} saveAction={createSaveAction()} />,
    );

    expect(screen.getByDisplayValue("Ocakbaşı Rheydt")).toBeInTheDocument();
    expect(screen.getByText("/laden/ocakbasi-rheydt-pilot")).toBeInTheDocument();
    expect(window.localStorage).toHaveLength(0);
  });

  it("updates the live preview before saving", () => {
    render(
      <WebsiteEditor initialData={initialData} saveAction={createSaveAction()} />,
    );

    fireEvent.change(screen.getByLabelText("Ladenname"), {
      target: { value: "Kebap Haus am Markt" },
    });

    expect(screen.getByText("Ungespeicherte Änderungen")).toBeInTheDocument();
    expect(screen.getAllByText("Kebap Haus am Markt")).toHaveLength(2);
  });

  it("submits the edited profile and publication status through the action", async () => {
    const saveAction = createSaveAction();
    render(<WebsiteEditor initialData={initialData} saveAction={saveAction} />);

    fireEvent.change(screen.getByLabelText("Ladenname"), {
      target: { value: "Kebap Haus am Markt" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Änderungen speichern" }),
      );
    });

    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1));
    const submitted = saveAction.mock.calls[0]?.[0];
    expect(JSON.parse(String(submitted?.get("profile")))).toMatchObject({
      name: "Kebap Haus am Markt",
      postalCode: "41236",
    });
    expect(submitted?.get("isPublished")).toBe("on");
    expect(window.localStorage).toHaveLength(0);
  });

  it("can save an unpublished draft without exposing an external link", async () => {
    const saveAction = createSaveAction();
    render(<WebsiteEditor initialData={initialData} saveAction={saveAction} />);

    fireEvent.click(screen.getByRole("checkbox"));
    expect(
      screen.queryByRole("link", { name: "Öffentliche Website öffnen" }),
    ).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Änderungen speichern" }),
      );
    });

    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1));
    expect(saveAction.mock.calls[0]?.[0].get("isPublished")).toBeNull();
  });
});
