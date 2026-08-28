import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemandPlanner } from "@/components/demand-planner";
import type { DemandPlanningData } from "@/lib/types";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const planning: DemandPlanningData = {
  canConfirm: true,
  editable: true,
  items: [
    {
      amount: 60,
      deliveryDate: "2026-08-24",
      id: "40000000-0000-4000-8000-000000000001",
      product: "Kalb-Drehspieß",
      specification: "20 kg · halal",
      unit: "kg",
    },
    {
      amount: 26,
      deliveryDate: "2026-08-24",
      id: "40000000-0000-4000-8000-000000000002",
      product: "Hähnchen-Drehspieß",
      specification: "15 kg · halal",
      unit: "kg",
    },
  ],
  round: {
    closesAt: "2026-08-22T16:00:00.000Z",
    committedKgWithoutStore: 598,
    deliveryDate: "2026-08-24",
    deliveryWindow: "24. August 2026 · 06:00–09:00 Uhr",
    id: "20000000-0000-4000-8000-000000000001",
    name: "Fleisch · 24. August",
    referencePricePerKg: 9.18,
    regionalKey: "mg-fleisch-2026-08-24",
    status: "OPEN",
    targetKg: 750,
    tiers: [
      { label: "Einzelkondition", minKg: 0, pricePerKg: 9.4 },
      { label: "Zielpreis", minKg: 750, pricePerKg: 8.42 },
    ],
  },
  submissionStatus: "DRAFT",
};

function createActions() {
  const action = () =>
    vi.fn<(formData: FormData) => Promise<void>>(async () => undefined);
  const quietAction = () =>
    vi.fn<(formData: FormData) => Promise<{ ok: boolean }>>(async () => ({
      ok: true,
    }));

  return {
    addAction: action(),
    applyTemplateAction: action(),
    confirmAction: action(),
    removeQuietAction: quietAction(),
    saveTemplateAction: action(),
    templateItemCount: 0,
    updateAction: action(),
    updateQuietAction: quietAction(),
  };
}

describe("DemandPlanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
    refresh.mockClear();
  });

  it("renders injected database data without reading or writing local storage", () => {
    render(
      <DemandPlanner
        {...createActions()}
        planning={planning}
        role="OWNER"
      />,
    );

    expect(screen.getByText("2 Positionen · 86 kg gesamt")).toBeInTheDocument();
    expect(screen.getByText("Kalb-Drehspieß")).toBeInTheDocument();
    expect(window.localStorage).toHaveLength(0);
  });

  it("submits a new position through the injected server action", async () => {
    const actions = createActions();
    render(
      <DemandPlanner {...actions} planning={planning} role="OWNER" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Position hinzufügen" }));
    const dialog = screen.getByRole("dialog", { name: "Bedarf hinzufügen" });
    fireEvent.change(within(dialog).getByLabelText("Menge in kg"), {
      target: { value: "25" },
    });
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Position hinzufügen" }),
      );
    });

    await waitFor(() => expect(actions.addAction).toHaveBeenCalledOnce());
    const submitted = actions.addAction.mock.calls[0]![0];
    expect(submitted.get("quantity")).toBe("25");
    expect(submitted.get("productName")).toBe("Kalb-Drehspieß");
    expect(window.localStorage).toHaveLength(0);
  });

  it("updates quantities optimistically before the quiet action resolves", async () => {
    const actions = createActions();
    let resolveUpdate: (() => void) | undefined;
    actions.updateQuietAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = () => resolve({ ok: true });
        }),
    );
    render(<DemandPlanner {...actions} planning={planning} role="OWNER" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Menge für Kalb-Drehspieß erhöhen" }),
    );

    expect(
      await screen.findByText("2 Positionen · 87 kg gesamt"),
    ).toBeInTheDocument();
    expect(actions.updateQuietAction).toHaveBeenCalledOnce();

    await act(async () => {
      resolveUpdate?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("keeps the demo wording only when the installation is a public demo", async () => {
    render(
      <DemandPlanner
        {...createActions()}
        demoMode
        planning={planning}
        role="OWNER"
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Bestätigung prüfen" }));
    });
    const dialog = screen.getByRole("dialog", {
      name: "Bedarf verbindlich bestätigen?",
    });
    expect(
      within(dialog).getByText(/keine echte Bestellung/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", {
        name: "Jetzt für die Demo-Gruppenmenge bestätigen",
      }),
    ).toBeInTheDocument();
  });

  it("offers confirmation only to an owner with an editable draft", async () => {
    const ownerActions = createActions();
    const { unmount } = render(
      <DemandPlanner {...ownerActions} planning={planning} role="OWNER" />,
    );
    const confirm = screen.getByRole("button", { name: "Bestätigung prüfen" });

    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(ownerActions.confirmAction).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", {
      name: "Bedarf verbindlich bestätigen?",
    });
    expect(within(dialog).getByText("86 kg")).toBeInTheDocument();
    // Ausserhalb der oeffentlichen Demo sagt der Dialog, was er tut: die
    // Menge ist verbindlich. Vorher stand dort unbedingt "In dieser
    // oeffentlichen Demo entsteht keine echte Bestellung" - ausgerechnet
    // an der Stelle, an der eine verbindliche Menge zugesagt wird.
    expect(within(dialog).getByText(/Diese Menge ist verbindlich/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Verbindlich bestätigen" }),
      );
    });
    await waitFor(() =>
      expect(ownerActions.confirmAction).toHaveBeenCalledOnce(),
    );

    unmount();
    render(
      <DemandPlanner
        {...createActions()}
        planning={{ ...planning, canConfirm: false }}
        role="EMPLOYEE"
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Bestätigung prüfen" }),
    ).not.toBeInTheDocument();
  });

  it("closes the confirmation review with Escape and restores focus", () => {
    render(<DemandPlanner {...createActions()} planning={planning} role="OWNER" />);
    const trigger = screen.getByRole("button", { name: "Bestätigung prüfen" });

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("renders a confirmed submission as read-only", () => {
    render(
      <DemandPlanner
        {...createActions()}
        planning={{
          ...planning,
          canConfirm: false,
          editable: false,
          submissionStatus: "CONFIRMED",
        }}
        role="OWNER"
      />,
    );

    expect(screen.getByText("Bestätigt")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Position hinzufügen" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/entfernen/)).not.toBeInTheDocument();
  });
});
