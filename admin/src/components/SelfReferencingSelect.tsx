import { Field, Flex, SingleSelect, SingleSelectOption } from "@strapi/design-system"
import { useIntl } from "react-intl"

import { getTranslation } from "../utils/getTranslation"

type MessageDescriptor = {
  id?: string
  defaultMessage?: string
}

export type SelfReferencingSelectProps = {
  name: string
  value?: boolean | null
  onChange: (event: { target: { name: string; value: boolean | undefined; type: string } }) => void
  intlLabel?: MessageDescriptor
  description?: MessageDescriptor
  disabled?: boolean
}

const toOptionValue = (value: boolean | null | undefined) => {
  if (value === true) return "true"
  if (value === false) return "false"
  return "default"
}

const fromOptionValue = (value: string) => {
  if (value === "true") return true
  if (value === "false") return false
  return undefined
}

export const SelfReferencingSelect = ({
  name,
  value,
  onChange,
  intlLabel,
  description,
  disabled,
}: SelfReferencingSelectProps) => {
  const { formatMessage } = useIntl()

  const label = formatMessage({
    id: intlLabel?.id ?? name,
    defaultMessage: intlLabel?.defaultMessage,
  })
  const hint = description
    ? formatMessage({ id: description.id ?? name, defaultMessage: description.defaultMessage })
    : undefined

  const options = [
    {
      value: "default",
      label: formatMessage({
        id: getTranslation("ctb.selfReferencing.default"),
        defaultMessage: "Use schema default",
      }),
    },
    {
      value: "true",
      label: formatMessage({
        id: getTranslation("ctb.selfReferencing.true"),
        defaultMessage: "Force deep traversal",
      }),
    },
    {
      value: "false",
      label: formatMessage({
        id: getTranslation("ctb.selfReferencing.false"),
        defaultMessage: "Stop after one level",
      }),
    },
  ]

  return (
    <Field.Root hint={hint} name={name}>
      <Flex alignItems="stretch" direction="column" gap={2}>
        <Field.Label>{label}</Field.Label>
        <SingleSelect
          aria-label={label}
          disabled={disabled}
          onChange={(next) =>
            onChange({
              target: {
                name,
                type: "deep-populate-self-referencing",
                value: fromOptionValue(String(next)),
              },
            })
          }
          value={toOptionValue(value)}
        >
          {options.map((option) => (
            <SingleSelectOption key={option.value} value={option.value}>
              {option.label}
            </SingleSelectOption>
          ))}
        </SingleSelect>
        <Field.Hint />
      </Flex>
    </Field.Root>
  )
}

export default SelfReferencingSelect
