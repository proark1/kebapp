import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebsiteEditor } from "@/components/website-editor";
import type { StorefrontEditorData } from "@/lib/types";
import { demoStoreProfile } from "@/test/fixtures/store-profile";

const initialData: StorefrontEditorData = {
  customDomain: null,
  domainRequestStatus: "NONE",
  isPublished: true,
  profile: demoStoreProfile,
  publicPath: "/laden/ocakbasi-rheydt-pilot",
  publicSlug: "ocakbasi-rheydt-pilot",
  requestedDomain: null,
};

function createSaveAction() {
  return vi.fn<(formData: FormData) => Promise<void>>(async () => undefined);
}

function createDomainAction() {
  return vi.fn<(formData: FormData) => Promise<void>>(async () => undefined);
}

describe("WebsiteEditor", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders injected database data without local storage", () => {
    render(
      <WebsiteEditor domainAction={createDomainAction()} initialData={initialData} saveAction={createSaveAction()} />,
    );

    expect(screen.getByDisplayValue("Ocakbaşı Rheydt")).toBeInTheDocument();
    expect(screen.getAllByText("/laden/ocakbasi-rheydt-pilot")).toHaveLength(2);
    expect(window.localStorage).toHaveLength(0);
  });

  it("updates the live preview before saving", () => {
    render(
      <WebsiteEditor domainAction={createDomainAction()} initialData={initialData} saveAction={createSaveAction()} />,
    );

    fireEvent.change(screen.getByLabelText("Ladenname"), {
      target: { value: "Kebap Haus am Markt" },
    });

    expect(screen.getByText("Ungespeicherte Änderungen")).toBeInTheDocument();
    expect(screen.getAllByText("Kebap Haus am Markt")).toHaveLength(2);
  });

  it("submits the edited profile and publication status through the action", async () => {
    const saveAction = createSaveAction();
    render(<WebsiteEditor domainAction={createDomainAction()} initialData={initialData} saveAction={saveAction} />);

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
    render(<WebsiteEditor domainAction={createDomainAction()} initialData={initialData} saveAction={saveAction} />);

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Website öffentlich anzeigen" }),
    );
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

  it("adds complete menu and opening-hour rows and persists selected features", async () => {
    const saveAction = createSaveAction();
    render(
      <WebsiteEditor
        domainAction={createDomainAction()}
        initialData={initialData}
        saveAction={saveAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Gericht" }));
    fireEvent.click(screen.getByRole("button", { name: "Zeile" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Halal" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));
    });

    await waitFor(() => expect(saveAction).toHaveBeenCalledOnce());
    const submitted = JSON.parse(
      String(saveAction.mock.calls[0]?.[0].get("profile")),
    );
    expect(submitted.menu).toHaveLength(5);
    expect(submitted.menu[4]).toMatchObject({
      category: "Döner",
      description: "",
      name: "Neues Gericht",
    });
    expect(submitted.openingHours).toHaveLength(4);
    expect(submitted.features).not.toContain("HALAL");
  });

  it("submits a syntactically valid domain only to the review action", async () => {
    const domainAction = createDomainAction();
    render(
      <WebsiteEditor
        domainAction={domainAction}
        initialData={initialData}
        saveAction={createSaveAction()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Gewünschte Domain/), {
      target: { value: "mein-doenerladen.de" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Zur Prüfung vormerken" }));
    });

    await waitFor(() => expect(domainAction).toHaveBeenCalledOnce());
    expect(domainAction.mock.calls[0]?.[0].get("requestedDomain")).toBe(
      "mein-doenerladen.de",
    );
  });

  it("rejects SVG logos in the browser before profile submission", () => {
    render(
      <WebsiteEditor
        domainAction={createDomainAction()}
        initialData={initialData}
        saveAction={createSaveAction()}
      />,
    );
    const file = new File(["<svg />"], "logo.svg", { type: "image/svg+xml" });

    fireEvent.change(screen.getByLabelText("Logo auswählen"), {
      target: { files: [file] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("SVG-Dateien sind nicht erlaubt");
  });

  it("rejects oversized header images without replacing the standard image", () => {
    render(
      <WebsiteEditor
        domainAction={createDomainAction()}
        initialData={initialData}
        saveAction={createSaveAction()}
      />,
    );
    const file = new File([new Uint8Array(1_024 * 1_024 + 1)], "hero.webp", {
      type: "image/webp",
    });

    fireEvent.change(screen.getByLabelText("Headerbild auswählen"), {
      target: { files: [file] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("größer als 1 MiB");
    expect(screen.getByText("Professionelles Standardmotiv")).toBeInTheDocument();
  });

  it("copies the phone number to WhatsApp and persists delivery options", async () => {
    const saveAction = createSaveAction();
    render(
      <WebsiteEditor
        domainAction={createDomainAction()}
        initialData={{
          ...initialData,
          profile: { ...demoStoreProfile, whatsappPhone: "" },
        }}
        saveAction={saveAction}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Telefonnummer übernehmen" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Lieferung anbieten/ }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));
    });

    await waitFor(() => expect(saveAction).toHaveBeenCalledOnce());
    const submitted = JSON.parse(
      String(saveAction.mock.calls[0]?.[0].get("profile")),
    );
    expect(submitted.whatsappPhone).toBe("+49 2166 123456");
    expect(submitted.deliveryEnabled).toBe(false);
    expect(submitted.pickupEnabled).toBe(true);
  });
});
