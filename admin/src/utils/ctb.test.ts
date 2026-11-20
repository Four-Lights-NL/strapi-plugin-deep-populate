import { attributeAdvancedForm, attributeValidator, contentTypeAdvancedForm, contentTypeValidator } from "./ctb"

describe("content type builder integration", () => {
  test("exposes content type options", () => {
    const items = contentTypeAdvancedForm()

    expect(items.map((item) => item.name)).toEqual([
      "pluginOptions.deep-populate.omitEmpty",
      "pluginOptions.deep-populate.localizations",
      "pluginOptions.deep-populate.selfReferencing",
      "pluginOptions.deep-populate.allow",
      "pluginOptions.deep-populate.deny",
    ])
  })

  test("exposes attribute options", () => {
    const items = attributeAdvancedForm({ type: "relation" })

    expect(items.map((item) => item.name)).toEqual([
      "pluginOptions.deep-populate.allow",
      "pluginOptions.deep-populate.deny",
    ])
  })

  test("hides attribute options while the component target is being selected", () => {
    expect(attributeAdvancedForm({ type: "component", step: "1" })).toEqual([])
    expect(attributeAdvancedForm({ type: "dynamiczone", step: "1" })).toEqual([])
    expect(attributeAdvancedForm({ type: "component", step: "2" })).toHaveLength(2)
  })

  test("validates plugin options", async () => {
    await expect(
      contentTypeValidator()["deep-populate"].validate({ omitEmpty: true, allow: { relations: ["api::page.page"] } }),
    ).resolves.toBeDefined()

    await expect(contentTypeValidator()["deep-populate"].validate({ omitEmpty: "yes" })).rejects.toBeDefined()
    await expect(
      attributeValidator()["deep-populate"].validate({ deny: { components: ["shared.link"] } }),
    ).resolves.toBeDefined()
    await expect(attributeValidator()["deep-populate"].validate({ omitEmpty: true })).resolves.toBeDefined()
  })
})
