import type { Permission } from "@strapi/admin/strapi-admin"

import { Layouts, Page, useFetchClient, useNotification, useRBAC } from "@strapi/admin/strapi-admin"
import { Box, Button, Checkbox, Flex, Typography } from "@strapi/design-system"
import { type ReactNode, useEffect, useState } from "react"
import { useIntl } from "react-intl"

import { getTranslation } from "../utils/getTranslation"

export const SETTINGS_PERMISSIONS: Permission[] = [{ action: "plugin::deep-populate.settings.access", subject: null }]

export type SettingsValue = {
  useCache: boolean
  replaceWildcard: boolean
  omitEmpty: boolean
  localizations: boolean
  cacheOptions: {
    clearCacheOnStartup: boolean
    warmOnWrite: boolean
  }
}

export const defaultSettings: SettingsValue = {
  useCache: true,
  replaceWildcard: true,
  omitEmpty: false,
  localizations: false,
  cacheOptions: {
    clearCacheOnStartup: false,
    warmOnWrite: false,
  },
}

export type SettingsPatch = Partial<Omit<SettingsValue, "cacheOptions">> & {
  cacheOptions?: Partial<SettingsValue["cacheOptions"]>
}

/**
 * Only send the fields the admin actually changed. Sending the effective values back would pin
 * values inherited from `config/plugins.js` (or the built-in defaults) into the store.
 */
export const getSettingsPatch = (initial: SettingsValue, next: SettingsValue): SettingsPatch => {
  const patch: SettingsPatch = {}

  if (initial.useCache !== next.useCache) patch.useCache = next.useCache
  if (initial.replaceWildcard !== next.replaceWildcard) patch.replaceWildcard = next.replaceWildcard
  if (initial.omitEmpty !== next.omitEmpty) patch.omitEmpty = next.omitEmpty
  if (initial.localizations !== next.localizations) patch.localizations = next.localizations

  const cacheOptions: Partial<SettingsValue["cacheOptions"]> = {}
  if (initial.cacheOptions.clearCacheOnStartup !== next.cacheOptions.clearCacheOnStartup)
    cacheOptions.clearCacheOnStartup = next.cacheOptions.clearCacheOnStartup
  if (initial.cacheOptions.warmOnWrite !== next.cacheOptions.warmOnWrite)
    cacheOptions.warmOnWrite = next.cacheOptions.warmOnWrite

  if (Object.keys(cacheOptions).length > 0) patch.cacheOptions = cacheOptions

  return patch
}

const hasSettingsPatch = (patch: SettingsPatch) =>
  Object.keys(patch).some((key) => key !== "cacheOptions") || Object.keys(patch.cacheOptions ?? {}).length > 0

export const normalizeSettings = (value: Partial<SettingsValue> | undefined): SettingsValue => ({
  useCache: value?.useCache ?? defaultSettings.useCache,
  replaceWildcard: value?.replaceWildcard ?? defaultSettings.replaceWildcard,
  omitEmpty: value?.omitEmpty ?? defaultSettings.omitEmpty,
  localizations: value?.localizations ?? defaultSettings.localizations,
  cacheOptions: {
    clearCacheOnStartup: value?.cacheOptions?.clearCacheOnStartup ?? defaultSettings.cacheOptions.clearCacheOnStartup,
    warmOnWrite: value?.cacheOptions?.warmOnWrite ?? defaultSettings.cacheOptions.warmOnWrite,
  },
})

type SettingRowProps = {
  name: keyof Omit<SettingsValue, "cacheOptions">
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (name: keyof Omit<SettingsValue, "cacheOptions">, checked: boolean) => void
}

const SettingRow = ({ name, label, description, checked, disabled, onChange }: SettingRowProps) => (
  <FieldRow description={description} label={label}>
    <Checkbox
      aria-label={label}
      checked={checked}
      disabled={disabled}
      name={name}
      onCheckedChange={(value) => onChange(name, value === true)}
    />
  </FieldRow>
)

type CacheSettingRowProps = {
  name: keyof SettingsValue["cacheOptions"]
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (name: keyof SettingsValue["cacheOptions"], checked: boolean) => void
}

const CacheSettingRow = ({ name, label, description, checked, disabled, onChange }: CacheSettingRowProps) => (
  <FieldRow description={description} label={label}>
    <Checkbox
      aria-label={label}
      checked={checked}
      disabled={disabled}
      name={name}
      onCheckedChange={(value) => onChange(name, value === true)}
    />
  </FieldRow>
)

const FieldRow = ({ label, description, children }: { label: string; description: string; children: ReactNode }) => (
  <Flex alignItems="center" gap={4} justifyContent="space-between" paddingBottom={4} paddingTop={4}>
    <Flex alignItems="flex-start" direction="column" gap={1}>
      <Typography fontWeight="semiBold">{label}</Typography>
      <Typography textColor="neutral600" variant="pi">
        {description}
      </Typography>
    </Flex>
    {children}
  </Flex>
)

export const SettingsPage = () => {
  const { formatMessage } = useIntl()
  const { get, put } = useFetchClient()
  const { toggleNotification } = useNotification()
  const { isLoading: isLoadingRBAC, allowedActions } = useRBAC(SETTINGS_PERMISSIONS)

  const [settings, setSettings] = useState<SettingsValue>(defaultSettings)
  const [baseline, setBaseline] = useState<SettingsValue>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasError, setHasError] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once
  useEffect(() => {
    let cancelled = false

    get<{ data: Partial<SettingsValue> }>("/deep-populate/settings")
      .then(({ data }) => {
        if (cancelled) return
        const normalized = normalizeSettings(data?.data)
        setSettings(normalized)
        setBaseline(normalized)
      })
      .catch(() => {
        if (!cancelled) setHasError(true)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const update = (name: keyof Omit<SettingsValue, "cacheOptions">, checked: boolean) => {
    setSettings((current) => ({ ...current, [name]: checked }))
  }

  const updateCache = (name: keyof SettingsValue["cacheOptions"], checked: boolean) => {
    setSettings((current) => ({ ...current, cacheOptions: { ...current.cacheOptions, [name]: checked } }))
  }

  const save = async () => {
    const patch = getSettingsPatch(baseline, settings)
    if (!hasSettingsPatch(patch)) return

    try {
      setIsSaving(true)
      const { data } = await put<{ data: Partial<SettingsValue> }>("/deep-populate/settings", patch)
      const normalized = normalizeSettings(data?.data)
      setSettings(normalized)
      setBaseline(normalized)
      toggleNotification({
        type: "success",
        message: formatMessage({
          id: getTranslation("settings.notification.success"),
          defaultMessage: "Settings saved",
        }),
      })
    } catch {
      toggleNotification({
        type: "danger",
        message: formatMessage({
          id: getTranslation("settings.notification.error"),
          defaultMessage: "Could not save the settings",
        }),
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || isLoadingRBAC) {
    return <Page.Loading />
  }

  if (hasError) {
    return <Page.Error />
  }

  const disabled = !allowedActions.canAccess

  const t = (key: string, defaultMessage: string) => formatMessage({ id: getTranslation(key), defaultMessage })

  return (
    <Page.Main tabIndex={-1}>
      <Layouts.Header
        primaryAction={
          <Button disabled={disabled} loading={isSaving} onClick={save} size="L">
            {t("settings.save", "Save")}
          </Button>
        }
        subtitle={t("settings.subtitle", "Configure the defaults used when deeply populating content.")}
        title={t("plugin.name", "Deep Populate")}
      />
      <Layouts.Content>
        <Box background="neutral0" hasRadius marginBottom={6} padding={6} shadow="filterShadow">
          <Typography tag="h2" variant="delta">
            {t("settings.section.global", "Global defaults")}
          </Typography>
          <Box paddingTop={2}>
            <SettingRow
              checked={settings.useCache}
              description={t("settings.useCache.description", "Cache resolved populate objects in the database.")}
              disabled={disabled}
              label={t("settings.useCache.label", "Use cache")}
              name="useCache"
              onChange={update}
            />
            <SettingRow
              checked={settings.replaceWildcard}
              description={t(
                "settings.replaceWildcard.description",
                "Turn `populate: '*'` requests into a deeply populated response.",
              )}
              disabled={disabled}
              label={t("settings.replaceWildcard.label", "Replace wildcard populate")}
              name="replaceWildcard"
              onChange={update}
            />
            <SettingRow
              checked={settings.omitEmpty}
              description={t(
                "settings.omitEmpty.description",
                "Leave relations without any value out of the populate object.",
              )}
              disabled={disabled}
              label={t("settings.omitEmpty.label", "Omit empty relations")}
              name="omitEmpty"
              onChange={update}
            />
            <SettingRow
              checked={settings.localizations}
              description={t(
                "settings.localizations.description",
                "Populate the localizations of localized content types.",
              )}
              disabled={disabled}
              label={t("settings.localizations.label", "Include localizations")}
              name="localizations"
              onChange={update}
            />
          </Box>
        </Box>
        <Box background="neutral0" hasRadius padding={6} shadow="filterShadow">
          <Typography tag="h2" variant="delta">
            {t("settings.section.cache", "Cache")}
          </Typography>
          <Box paddingTop={2}>
            <CacheSettingRow
              checked={settings.cacheOptions.clearCacheOnStartup}
              description={t(
                "settings.clearCacheOnStartup.description",
                "Remove all cached populate objects when Strapi starts.",
              )}
              disabled={disabled}
              label={t("settings.clearCacheOnStartup.label", "Clear cache on startup")}
              name="clearCacheOnStartup"
              onChange={updateCache}
            />
            <CacheSettingRow
              checked={settings.cacheOptions.warmOnWrite}
              description={t(
                "settings.warmOnWrite.description",
                "Re-warm cached entries after a document is updated. This can be slow.",
              )}
              disabled={disabled}
              label={t("settings.warmOnWrite.label", "Warm cache on write")}
              name="warmOnWrite"
              onChange={updateCache}
            />
          </Box>
        </Box>
      </Layouts.Content>
    </Page.Main>
  )
}

export const ProtectedSettingsPage = () => (
  <Page.Protect permissions={SETTINGS_PERMISSIONS}>
    <SettingsPage />
  </Page.Protect>
)

export default SettingsPage
