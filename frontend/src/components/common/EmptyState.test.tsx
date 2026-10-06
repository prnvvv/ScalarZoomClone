import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="No upcoming meetings" />);
    expect(screen.getByText("No upcoming meetings")).toBeTruthy();
  });

  it("omits the description when it is not provided", () => {
    render(<EmptyState title="No recent meetings" />);
    expect(screen.queryByText("Meetings you attended")).toBeNull();
  });

  it("renders the description when provided", () => {
    render(
      <EmptyState
        title="No recent meetings"
        description="Meetings you attended will appear here."
      />
    );
    expect(
      screen.getByText("Meetings you attended will appear here.")
    ).toBeTruthy();
  });

  it("renders the action slot", () => {
    render(
      <EmptyState
        title="No upcoming meetings"
        action={<button type="button">Schedule a Meeting</button>}
      />
    );
    expect(
      screen.getByRole("button", { name: "Schedule a Meeting" })
    ).toBeTruthy();
  });

  it("marks the decorative icon as hidden from assistive tech", () => {
    const { container } = render(<EmptyState title="Nothing here" />);
    const icon = container.querySelector(".state-block__icon svg");
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });
});
