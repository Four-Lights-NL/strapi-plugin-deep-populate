import type { ReactNode } from "react"

import { fireEvent, render, screen } from "@testing-library/react"
import { IntlProvider } from "react-intl"

import { SelfReferencingSelect } from "./SelfReferencingSelect"

vi.mock("@strapi/design-system", () => ({
  Field: {
    Root: ({ children, hint }: { children: ReactNode; hint?: string }) => (
      <div>
        {hint ? <p>{hint}</p> : null}
        {children}
      </div>
    ),
    Label: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Hint: () => null,
  },
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SingleSelect: ({
    "aria-label": ariaLabel,
    value,
    onChange,
    children,
  }: {
    "aria-label": string
    value: string
    onChange: (value: string) => void
    children: ReactNode
  }) => (
    <select aria-label={ariaLabel} onChange={(event) => onChange(event.target.value)} value={value}>
      {children}
    </select>
  ),
  SingleSelectOption: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}))

const renderSelect = (props: Partial<React.ComponentProps<typeof SelfReferencingSelect>> = {}) =>
  render(
    <IntlProvider locale="en" messages={{}}>
      <SelfReferencingSelect name="pluginOptions.deep-populate.selfReferencing" onChange={vi.fn()} {...props} />
    </IntlProvider>,
  )

describe("SelfReferencingSelect", () => {
  test("maps the stored tri-state value to the select", () => {
    const { rerender } = renderSelect({ value: undefined })
    expect(screen.getByRole("combobox")).toHaveValue("default")

    rerender(
      <IntlProvider locale="en" messages={{}}>
        <SelfReferencingSelect name="pluginOptions.deep-populate.selfReferencing" onChange={vi.fn()} value={true} />
      </IntlProvider>,
    )
    expect(screen.getByRole("combobox")).toHaveValue("true")

    rerender(
      <IntlProvider locale="en" messages={{}}>
        <SelfReferencingSelect name="pluginOptions.deep-populate.selfReferencing" onChange={vi.fn()} value={false} />
      </IntlProvider>,
    )
    expect(screen.getByRole("combobox")).toHaveValue("false")
  })

  test("deletes the option for the schema default", () => {
    const onChange = vi.fn()
    renderSelect({ onChange, value: true })

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "default" } })

    expect(onChange).toHaveBeenCalledWith({
      target: {
        name: "pluginOptions.deep-populate.selfReferencing",
        type: "deep-populate-self-referencing",
        value: undefined,
      },
    })
  })

  test("writes booleans for the explicit states", () => {
    const onChange = vi.fn()
    renderSelect({ onChange, value: undefined })

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "false" } })

    expect(onChange).toHaveBeenCalledWith({
      target: {
        name: "pluginOptions.deep-populate.selfReferencing",
        type: "deep-populate-self-referencing",
        value: false,
      },
    })
  })
})
