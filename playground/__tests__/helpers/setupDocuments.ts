import type { Data } from "@strapi/strapi"

export const setupDocuments = async () => {
  const nestedSection = {
    input: {
      name: "Nested Section",
      content: "This is a nested section",
      singleCoolComponent: {
        title: "single cool component",
        isCool: true,
        text: "A single but cool component",
        specialRepeatable: [{ isSpecial: true, name: "target in singleCoolComponent" }],
      },
      coolitems: [
        {
          title: "a hot potato",
          isCool: false,
          text: "Full of carbs",
          specialRepeatable: [{ isSpecial: false, name: "a nested non-special component, in a nested section" }],
        },
      ],
      blocks: [
        {
          __component: "cms.cool-component" as const,
          isCool: true,
          title: "nested sections are dynamic and cool",
          specialRepeatable: [
            {
              isSpecial: false,
              name: "a nested non-special component, in a nested section",
            },
          ],
        },
      ],
    },
    output: {} as Data.ContentType<"api::section.section">,
  }
  nestedSection.output = await strapi.documents("api::section.section").create({
    data: nestedSection.input,
    populate: {
      target: true,
      localizations: { populate: "*" },
      singleCoolComponent: { populate: { specialRepeatable: { populate: { users: true } }, specialSingle: true } },
      coolitems: { populate: { specialRepeatable: { populate: { users: true } }, specialSingle: true } },
      sections: true,
      blocks: {
        on: {
          "cms.cool-component": {
            populate: {
              specialSingle: { populate: { users: true } },
              specialRepeatable: { populate: { users: true } },
            },
          },
          "cms.special": { populate: "*" },
        },
      },
    },
  })

  const primarySection = {
    input: {
      name: "Primary Section",
      content: "This is a primary section",
      coolitems: [
        {
          title: "beer",
          isCool: true,
          text: "Cool and refreshing",
          specialRepeatable: [{ isSpecial: false, name: "a test" }],
        },
        { title: "water", isCool: true, text: "It's what plants crave", specialRepeatable: [] },
      ],
      blocks: [
        {
          __component: "cms.cool-component" as const,
          isCool: true,
          title: "dynamic and cool",
          specialRepeatable: [
            {
              isSpecial: false,
              name: "a nested non-special component",
            },
            {
              isSpecial: true,
              name: "a nested and very special component",
            },
          ],
        },
        {
          __component: "cms.special" as const,
          isSpecial: true,
          name: "dynamic and special",
        },
      ],
      sections: { connect: [nestedSection.output.documentId] },
    },
    output: {} as Data.ContentType<"api::section.section">,
  }
  primarySection.output = await strapi.documents("api::section.section").create({
    data: primarySection.input,
    populate: {
      target: true,
      singleCoolComponent: true,
      localizations: { populate: "*" },
      coolitems: { populate: { specialSingle: true, specialRepeatable: { populate: { users: true } } } },
      blocks: {
        on: {
          "cms.cool-component": {
            populate: {
              specialSingle: { populate: { users: true } },
              specialRepeatable: { populate: { users: true } },
            },
          },
          "cms.special": { populate: "*" },
        },
      },
    },
  })

  const page = {
    input: {
      title: "example page",
      slug: "example-page",
      sections: { connect: [primarySection.output.documentId] },
    },
    output: {} as Data.ContentType<"api::page.page">,
  }

  page.output = await strapi.documents("api::page.page").create({
    data: page.input,
    populate: ["localizations", "members"],
  })

  return { page, primarySection, nestedSection }
}
