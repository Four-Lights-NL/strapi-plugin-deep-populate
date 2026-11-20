import { useFetchClient } from "@strapi/admin/strapi-admin"
import { Field, Flex, MultiSelectNested, Typography } from "@strapi/design-system"
import { useEffect, useMemo, useState } from "react"
import { useIntl } from "react-intl"

import { getTranslation } from "../utils/getTranslation"

export type AllowDenyValue = {
  relations?: string[]
  components?: string[]
}

type Target = {
  uid: string
  displayName: string
}

type Targets = {
  contentTypes: Target[]
  components: Target[]
}

type MessageDescriptor = {
  id?: string
  defaultMessage?: string
}

export type AllowDenySelectProps = {
  name: string
  value?: AllowDenyValue | null
  onChange: (event: { target: { name: string; value: AllowDenyValue; type: string } }) => void
  intlLabel?: MessageDescriptor
  description?: MessageDescriptor
  disabled?: boolean
}

const getId = (descriptor: MessageDescriptor | undefined, name: string) => descriptor?.id ?? name

const formatDescriptor = (
  formatMessage: (descriptor: { id: string; defaultMessage?: string }) => string,
  descriptor: MessageDescriptor | undefined,
  name: string,
) => formatMessage({ id: getId(descriptor, name), defaultMessage: descriptor?.defaultMessage })

export const AllowDenySelect = ({ name, value, onChange, intlLabel, description, disabled }: AllowDenySelectProps) => {
  const { formatMessage } = useIntl()
  const { get } = useFetchClient()
  const [targets, setTargets] = useState<Targets>({ contentTypes: [], components: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Targets are static for the lifetime of the admin panel.
  // biome-ignore lint/correctness/useExhaustiveDependencies: load once
  useEffect(() => {
    let cancelled = false

    get<Targets>("/deep-populate/targets")
      .then(({ data }) => {
        if (cancelled) return
        setTargets({
          contentTypes: data?.contentTypes ?? [],
          components: data?.components ?? [],
        })
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

  const relationOptions = useMemo(
    () => targets.contentTypes.map(({ uid, displayName }) => ({ label: displayName, value: uid })),
    [targets.contentTypes],
  )
  const componentOptions = useMemo(
    () => targets.components.map(({ uid, displayName }) => ({ label: displayName, value: uid })),
    [targets.components],
  )

  const update = (patch: Partial<AllowDenyValue>) => {
    const relations = patch.relations ?? value?.relations
    const components = patch.components ?? value?.components

    onChange({
      target: {
        name,
        type: "deep-populate-allow-deny",
        // Only include lists that were already configured or that the user actively selected. An
        // absent list means "no restriction"; an explicitly empty list means "allow nothing".
        value: {
          ...(relations !== undefined ? { relations } : {}),
          ...(components !== undefined ? { components } : {}),
        },
      },
    })
  }

  const label = formatDescriptor(formatMessage, intlLabel, name)
  const hint = description ? formatDescriptor(formatMessage, description, name) : undefined
  const relationsLabel = formatMessage({
    id: getTranslation("ctb.allowDeny.relations"),
    defaultMessage: "Relations",
  })
  const componentsLabel = formatMessage({
    id: getTranslation("ctb.allowDeny.components"),
    defaultMessage: "Components",
  })
  const placeholder = formatMessage({
    id: getTranslation("ctb.allowDeny.placeholder"),
    defaultMessage: "Select targets",
  })
  const errorMessage = formatMessage({
    id: getTranslation("ctb.allowDeny.error"),
    defaultMessage: "Could not load content types and components",
  })
  const loadingMessage = formatMessage({
    id: getTranslation("ctb.allowDeny.loading"),
    defaultMessage: "Loading targets...",
  })

  return (
    <Field.Root error={hasError ? errorMessage : undefined} hint={hint} name={name}>
      <Flex alignItems="stretch" direction="column" gap={2}>
        <Field.Label>{label}</Field.Label>
        {isLoading ? (
          <Typography textColor="neutral600">{loadingMessage}</Typography>
        ) : hasError ? (
          <Typography textColor="danger600">{errorMessage}</Typography>
        ) : (
          <>
            <Typography fontWeight="bold" variant="pi">
              {relationsLabel}
            </Typography>
            <MultiSelectNested
              aria-label={relationsLabel}
              disabled={disabled}
              onChange={(relations) => update({ relations })}
              options={relationOptions}
              placeholder={placeholder}
              value={value?.relations ?? []}
            />
            <Typography fontWeight="bold" variant="pi">
              {componentsLabel}
            </Typography>
            <MultiSelectNested
              aria-label={componentsLabel}
              disabled={disabled}
              onChange={(components) => update({ components })}
              options={componentOptions}
              placeholder={placeholder}
              value={value?.components ?? []}
            />
          </>
        )}
        <Field.Hint />
      </Flex>
    </Field.Root>
  )
}

export default AllowDenySelect
