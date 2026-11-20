import * as yup from "yup"

import { getTranslation } from "./getTranslation"

export type AdvancedFormProps = {
  type?: string
  step?: string
  forTarget?: "contentType" | "component"
}

const allowDenySchema = yup.object().shape({
  relations: yup.array().of(yup.string()),
  components: yup.array().of(yup.string()),
})

const schemaValidatorShape = {
  "deep-populate": yup.object().shape({
    omitEmpty: yup.boolean(),
    localizations: yup.boolean(),
    selfReferencing: yup.boolean(),
    allow: allowDenySchema,
    deny: allowDenySchema,
  }),
}

const attributeValidatorShape = {
  "deep-populate": yup.object().shape({
    allow: allowDenySchema,
    deny: allowDenySchema,
  }),
}

export const contentTypeValidator = () => schemaValidatorShape

export const attributeValidator = () => attributeValidatorShape

const allowDenyItem = (kind: "allow" | "deny") => ({
  name: `pluginOptions.deep-populate.${kind}`,
  type: "deep-populate-allow-deny",
  intlLabel: {
    id: getTranslation(`ctb.${kind}.label`),
    defaultMessage: kind === "allow" ? "Allowed relations and components" : "Denied relations and components",
  },
  description: {
    id: getTranslation(`ctb.${kind}.description`),
    defaultMessage:
      kind === "allow"
        ? "Restrict deep population to these relations and components."
        : "Stop deep population at these relations and components.",
  },
})

export const contentTypeAdvancedForm = () => [
  {
    name: "pluginOptions.deep-populate.omitEmpty",
    type: "checkbox",
    intlLabel: {
      id: getTranslation("settings.omitEmpty.label"),
      defaultMessage: "Omit empty relations",
    },
    description: {
      id: getTranslation("settings.omitEmpty.description"),
      defaultMessage: "Leave relations without any value out of the populate object.",
    },
  },
  {
    name: "pluginOptions.deep-populate.localizations",
    type: "checkbox",
    intlLabel: {
      id: getTranslation("settings.localizations.label"),
      defaultMessage: "Include localizations",
    },
    description: {
      id: getTranslation("settings.localizations.description"),
      defaultMessage: "Populate the localizations of localized content types.",
    },
  },
  {
    name: "pluginOptions.deep-populate.selfReferencing",
    type: "deep-populate-self-referencing",
    intlLabel: {
      id: getTranslation("ctb.selfReferencing.label"),
      defaultMessage: "Force deep self-referencing traversal",
    },
    description: {
      id: getTranslation("ctb.selfReferencing.description"),
      defaultMessage:
        "Keep traversing self-referential relations, including indirect self-references through components and dynamic zones.",
    },
  },
  allowDenyItem("allow"),
  allowDenyItem("deny"),
]

/**
 * Advanced form items for relation, component and dynamic zone attributes. The attribute target is
 * always populated; the options only apply to its subtree.
 */
export const attributeAdvancedForm = ({ type, step }: AdvancedFormProps = {}) => {
  // For components and dynamic zones the first step selects the target, so there is no attribute
  // to configure yet.
  if ((type === "component" || type === "dynamiczone") && step === "1") return []

  return [allowDenyItem("allow"), allowDenyItem("deny")]
}
