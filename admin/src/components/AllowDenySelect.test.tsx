import { fireEvent, render, screen } from "@testing-library/react"
import { IntlProvider } from "react-intl"

import { AllowDenySelect } from "./AllowDenySelect"

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }))

vi.mock("@strapi/admin/strapi-admin", () => ({
  useFetchClient: () => ({ get: mockGet }),
}))

vi.mock("@strapi/design-system", () => ({
  DesignSystemProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  lightTheme: {},
  Field: {
    Root: ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
      <div>
        {hint ? <p>{hint}</p> : null}
        {children}
      </div>
    ),
    Label: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    Hint: () => null,
  },
  Flex: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Typography: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  MultiSelectNested: ({
    "aria-label": ariaLabel,
    options,
    value,
    onChange,
  }: {
    "aria-label": string
    options: { label: string; value: string }[]
    value: string[]
    onChange: (value: string[]) => void
  }) => (
    <select
      aria-label={ariaLabel}
      multiple
      onChange={(event) =>
        onChange(
          Array.from(event.target.options)
            .filter((option) => option.selected)
            .map((option) => option.value),
        )
      }
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))

const renderInput = (props: Partial<React.ComponentProps<typeof AllowDenySelect>> = {}) =>
  render(
    <IntlProvider locale="en" messages={{}}>
      <AllowDenySelect name="pluginOptions.deep-populate.allow" onChange={vi.fn()} {...props} />
    </IntlProvider>,
  )

describe("AllowDenySelect", () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  test("loads the available targets", async () => {
    mockGet.mockResolvedValue({
      data: {
        contentTypes: [{ uid: "api::page.page", displayName: "Page" }],
        components: [{ uid: "shared.link", displayName: "Link" }],
      },
    })

    renderInput()

    expect(await screen.findByText("Relations")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Page" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Link" })).toBeInTheDocument()
    expect(mockGet).toHaveBeenCalledWith("/deep-populate/targets")
  })

  test("reports changes for the relations and components lists", async () => {
    mockGet.mockResolvedValue({
      data: {
        contentTypes: [{ uid: "api::page.page", displayName: "Page" }],
        components: [{ uid: "shared.link", displayName: "Link" }],
      },
    })

    const onChange = vi.fn()
    renderInput({ onChange, value: { relations: [], components: [] } })

    fireEvent.change(await screen.findByLabelText("Relations"), { target: { value: "api::page.page" } })
    expect(onChange).toHaveBeenCalledWith({
      target: {
        name: "pluginOptions.deep-populate.allow",
        type: "deep-populate-allow-deny",
        value: { relations: ["api::page.page"], components: [] },
      },
    })

    fireEvent.change(screen.getByLabelText("Components"), { target: { value: "shared.link" } })
    expect(onChange).toHaveBeenLastCalledWith({
      target: {
        name: "pluginOptions.deep-populate.allow",
        type: "deep-populate-allow-deny",
        value: { relations: [], components: ["shared.link"] },
      },
    })
  })

  test("shows an error when targets cannot be loaded", async () => {
    mockGet.mockRejectedValue(new Error("nope"))

    renderInput()

    expect(await screen.findByText("Could not load content types and components")).toBeInTheDocument()
  })

  test("formats the supplied label and description", () => {
    mockGet.mockResolvedValue({ data: { contentTypes: [], components: [] } })

    renderInput({
      intlLabel: { id: "custom.label", defaultMessage: "Custom label" },
      description: { id: "custom.description", defaultMessage: "Custom description" },
    })

    expect(screen.getByText("Custom label")).toBeInTheDocument()
    expect(screen.getByText("Custom description")).toBeInTheDocument()
  })
})
