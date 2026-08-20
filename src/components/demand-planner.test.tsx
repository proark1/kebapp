import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DemandPlanner } from "@/components/demand-planner";
import { DEMANDS_STORAGE_KEY } from "@/lib/storage";

describe("DemandPlanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("adds and persists a demand position", () => {
    render(<DemandPlanner />);

    fireEvent.click(screen.getByRole("button", { name: "Position hinzufügen" }));
    const dialog = screen.getByRole("dialog", { name: "Bedarf hinzufügen" });
    fireEvent.change(within(dialog).getByLabelText("Menge in kg"), {
      target: { value: "25" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Position hinzufügen" }));

    expect(screen.getByText("Position hinzugefügt und gespeichert")).toBeInTheDocument();
    expect(screen.getByText("3 Positionen · 111 kg gesamt")).toBeInTheDocument();
    expect(window.localStorage.getItem(DEMANDS_STORAGE_KEY)).toContain('"amount":25');
  });

  it("rejects implausible quantities", () => {
    render(<DemandPlanner />);

    fireEvent.click(screen.getByRole("button", { name: "Position hinzufügen" }));
    const dialog = screen.getByRole("dialog", { name: "Bedarf hinzufügen" });
    fireEvent.change(within(dialog).getByLabelText("Menge in kg"), {
      target: { value: "0" },
    });
    fireEvent.submit(within(dialog).getByRole("button", { name: "Position hinzufügen" }).closest("form")!);

    expect(screen.getByText("Bitte eine Menge zwischen 1 und 500 kg eintragen")).toBeInTheDocument();
  });
});
