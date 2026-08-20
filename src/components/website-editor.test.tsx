import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { WebsiteEditor } from "@/components/website-editor";
import { STORE_STORAGE_KEY } from "@/lib/storage";

describe("WebsiteEditor", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves changed store information for the public website", () => {
    render(<WebsiteEditor />);

    fireEvent.change(screen.getByLabelText("Ladenname"), {
      target: { value: "Kebap Haus am Markt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));

    expect(screen.getByText("Website-Einstellungen gespeichert")).toBeInTheDocument();
    expect(window.localStorage.getItem(STORE_STORAGE_KEY)).toContain("Kebap Haus am Markt");
  });
});
