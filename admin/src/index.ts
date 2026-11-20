import type { StrapiApp } from "@strapi/admin/strapi-admin"

import AllowDenySelect from "./components/AllowDenySelect"
import SelfReferencingSelect from "./components/SelfReferencingSelect"
import { pluginId } from "./pluginId"
import {
  type AdvancedFormProps,
  attributeAdvancedForm,
  attributeValidator,
  contentTypeAdvancedForm,
  contentTypeValidator,
} from "./utils/ctb"
import { getTranslation } from "./utils/getTranslation"
import { prefixPluginTranslations } from "./utils/prefixPluginTranslations"

type FormsApi = {
  components: {
    add: (input: { id: string; component: unknown }) => void
  }
  extendContentType: (input: { validator?: () => Record<string, unknown>; form: { advanced: () => unknown[] } }) => void
  extendFields: (
    fields: string[],
    input: {
      validator?: () => Record<string, unknown>
      form: { advanced: (props: AdvancedFormProps) => unknown[]; base?: () => unknown[] }
    },
  ) => void
}

const settingsPermissions = [{ action: "plugin::deep-populate.settings.access", subject: null }]

export default {
  register(app: StrapiApp) {
    app.registerPlugin({
      id: pluginId,
      name: "Deep Populate",
    })
  },

  bootstrap(app: StrapiApp) {
    const contentBuilder = app.getPlugin("content-type-builder")

    if (contentBuilder) {
      const forms = contentBuilder.apis.forms as FormsApi | undefined

      if (forms) {
        forms.components.add({
          id: "deep-populate-allow-deny",
          component: AllowDenySelect,
        })

        forms.components.add({
          id: "deep-populate-self-referencing",
          component: SelfReferencingSelect,
        })

        forms.extendContentType({
          validator: contentTypeValidator,
          form: {
            advanced: contentTypeAdvancedForm,
          },
        })

        forms.extendFields(["relation", "component", "dynamiczone"], {
          validator: attributeValidator,
          form: {
            advanced: (props) => attributeAdvancedForm(props),
            base: () => [],
          },
        })
      }
    }

    app.addSettingsLink("global", {
      id: pluginId,
      to: pluginId,
      intlLabel: {
        id: getTranslation("plugin.name"),
        defaultMessage: "Deep Populate",
      },
      Component: () => import("./pages/SettingsPage").then((module) => ({ default: module.ProtectedSettingsPage })),
      permissions: settingsPermissions,
    })
  },

  async registerTrads({ locales }: { locales: string[] }) {
    const importedTrads = await Promise.all(
      locales.map(async (locale) => {
        if (locale === "en") {
          const data = (await import("./translations/en.json")).default
          return {
            data: prefixPluginTranslations(data, pluginId),
            locale,
          }
        }

        return {
          data: {},
          locale,
        }
      }),
    )

    return importedTrads
  },
}
