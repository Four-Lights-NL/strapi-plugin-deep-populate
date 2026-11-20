import type { ReactNode } from "react"

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { IntlProvider } from "react-intl"

import { SettingsPage } from "./SettingsPage"

const { mockGet, mockPut, mockToggleNotification } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockToggleNotification: vi.fn(),
}))

vi.mock("@strapi/admin/strapi-admin", () => {
  const Main = ({ children }: { children: ReactNode }) => <main>{children}</main>
  const Header = ({ title, primaryAction }: { title: string; primaryAction?: ReactNode }) => (
    <header>
      {title}
      {primaryAction}
    </header>
  )
  const Content = ({ children }: { children: ReactNode }) => <section>{children}</section>
  const Loading = () => <div>Loading</div>
  const ErrorPage = () => <div>Error</div>
  const Protect = ({ children }: { children: ReactNode }) => <>{children}</>

  return {
    Page: { Main, Header, Content, Loading, Error: ErrorPage, Protect },
    Layouts: { Header, Content },
    useFetchClient: () => ({ get: mockGet, put: mockPut }),
    useNotification: () => ({ toggleNotification: mockToggleNotification }),
    useRBAC: () => ({ isLoading: false, allowedActions: { canAccess: true } }),
  }
})

vi.mock("@strapi/design-system", () => ({
  DesignSystemProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  lightTheme: {},
  Box: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Typography: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick} type="button">
      {children}
    </button>
  ),
  Checkbox: ({
    checked,
    onCheckedChange,
    name,
    "aria-label": ariaLabel,
  }: {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    name: string
    "aria-label": string
  }) => (
    <input
      aria-label={ariaLabel}
      checked={checked}
      name={name}
      onChange={(event) => onCheckedChange(event.target.checked)}
      type="checkbox"
    />
  ),
}))

const settings = {
  useCache: true,
  replaceWildcard: false,
  omitEmpty: true,
  localizations: false,
  cacheOptions: { clearCacheOnStartup: true, warmOnWrite: false },
}

const renderPage = () =>
  render(
    <IntlProvider locale="en" messages={{}}>
      <SettingsPage />
    </IntlProvider>,
  )

describe("SettingsPage", () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPut.mockReset()
    mockToggleNotification.mockReset()
  })

  test("loads and displays the settings", async () => {
    mockGet.mockResolvedValue({ data: { data: settings } })

    renderPage()

    expect(await screen.findByText("Use cache")).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Use cache" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Replace wildcard populate" })).not.toBeChecked()
  })

  test("saves the edited settings", async () => {
    mockGet.mockResolvedValue({ data: { data: settings } })
    mockPut.mockResolvedValue({ data: { data: { ...settings, useCache: false } } })

    renderPage()

    fireEvent.click(await screen.findByRole("checkbox", { name: "Use cache" }))
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(mockPut).toHaveBeenCalledWith("/deep-populate/settings", { useCache: false }))
    expect(mockToggleNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", message: "Settings saved" }),
    )
  })

  test("does not persist inherited values that were not edited", async () => {
    mockGet.mockResolvedValue({ data: { data: settings } })

    renderPage()

    await screen.findByText("Use cache")
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(mockPut).not.toHaveBeenCalled()
  })

  test("shows an error when the settings cannot be loaded", async () => {
    mockGet.mockRejectedValue(new Error("nope"))

    renderPage()

    expect(await screen.findByText("Error")).toBeInTheDocument()
  })
})
