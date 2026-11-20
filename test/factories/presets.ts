import type { Handle, Ref } from "./handle"

import { asBlock, coolComponent, link, special } from "./components"
import { connect } from "./handle"
import { createPage } from "./page"
import { createSection } from "./section"
import { uniqueValue } from "./unique"

const NESTED_POPULATE = {
  target: true,
  localizations: { populate: "*" },
  singleCoolComponent: {
    populate: { specialRepeatable: { populate: { users: true, linkedSections: true } }, specialSingle: true },
  },
  coolitems: {
    populate: { specialRepeatable: { populate: { users: true, linkedSections: true } }, specialSingle: true },
  },
  sections: true,
  blocks: {
    on: {
      "cms.cool-component": {
        populate: {
          specialSingle: { populate: { users: true, linkedSections: true } },
          specialRepeatable: { populate: { users: true, linkedSections: true } },
        },
      },
      "cms.special": { populate: "*" },
    },
  },
} as const

export type StandardGraph = {
  page: Handle
  primarySection: Handle
  nestedSection: Handle
}

/**
 * Reproduce the original `setupDocuments` fixture: a page → primary section →
 * nested section graph with single/repeatable/dynamic-zone components.
 *
 * Required unique fields (`name`, `slug`) are auto-uniqued so the graph can be
 * seeded repeatedly in one run (the memory suite does).
 */
export const seedStandardGraph = async (linkToPageId?: Ref): Promise<StandardGraph> => {
  const nestedBlocks: Record<string, unknown>[] = [
    asBlock(
      "cms.cool-component",
      coolComponent({
        isCool: true,
        title: "nested sections are dynamic and cool",
        specialRepeatable: [{ isSpecial: false, name: "a nested non-special component, in a nested section" }],
      }),
    ),
  ]
  if (linkToPageId !== undefined) {
    nestedBlocks.push(asBlock("shared.link", link({ label: "to main page", page: linkToPageId })))
  }

  const nestedSection = await createSection(
    {
      name: uniqueValue("Nested Section"),
      content: "This is a nested section",
      singleCoolComponent: coolComponent({
        title: "single cool component",
        isCool: true,
        text: "A single but cool component",
        specialRepeatable: [{ isSpecial: true, name: "target in singleCoolComponent" }],
      }),
      coolitems: [
        coolComponent({
          title: "a hot potato",
          isCool: false,
          text: "Full of carbs",
          specialRepeatable: [{ isSpecial: false, name: "a nested non-special component, in a nested section" }],
        }),
      ],
      blocks: nestedBlocks,
    },
    { populate: NESTED_POPULATE },
  )

  const primarySection = await createSection(
    {
      name: uniqueValue("Primary Section"),
      content: "This is a primary section",
      coolitems: [
        coolComponent({
          title: "beer",
          isCool: true,
          text: "Cool and refreshing",
          specialRepeatable: [{ isSpecial: false, name: "a test" }],
        }),
        coolComponent({ title: "water", isCool: true, text: "It's what plants crave", specialRepeatable: [] }),
      ],
      blocks: [
        asBlock(
          "cms.cool-component",
          coolComponent({
            isCool: true,
            title: "dynamic and cool",
            specialRepeatable: [
              { isSpecial: false, name: "a nested non-special component" },
              { isSpecial: true, name: "a nested and very special component" },
            ],
          }),
        ),
        asBlock("cms.special", special({ isSpecial: true, name: "dynamic and special" })),
      ],
      sections: connect(nestedSection),
    },
    {
      populate: {
        target: true,
        singleCoolComponent: true,
        localizations: { populate: "*" },
        coolitems: {
          populate: { specialSingle: true, specialRepeatable: { populate: { users: true, linkedSections: true } } },
        },
        blocks: NESTED_POPULATE.blocks,
      },
    },
  )

  const page = await createPage(
    { title: "example page", sections: connect(primarySection) },
    { populate: ["localizations", "members", "image"] },
  )

  return { page, primarySection, nestedSection }
}

/**
 * A page whose section holds a `shared.link` block pointing back at it, plus
 * the shallow (unpopulated) target page. Used by the deny/allow config tests.
 */
export const pageWithLink = async (target?: Handle) => {
  const page = target ?? (await createPage())
  const sectionWithLink = await createSection(
    {
      name: uniqueValue("section-with-link"),
      blocks: [asBlock("shared.link", link({ label: "to main page", page }))],
    },
    { populate: ["localizations", "target", "singleCoolComponent", "sections", "coolitems", "blocks"] },
  )
  const withLink = await createPage(
    { title: uniqueValue("page with link"), sections: connect(sectionWithLink) },
    { populate: ["image", "localizations", "members"] },
  )
  const shallowTargetPage = await page.refresh()

  return { page, sectionWithLink, pageWithLink: withLink, shallowTargetPage }
}

/**
 * A linear `section → section → …` chain of `depth` sections (root first).
 * Each level connects to the next, giving deep-populate a path to walk.
 */
export const deepChain = async (depth: number): Promise<Handle[]> => {
  const chain: Handle[] = []
  let previous: Handle | undefined

  for (let i = 0; i < depth; i += 1) {
    const section = await createSection({
      name: uniqueValue(`chain-${i}`),
      ...(previous ? { sections: connect(previous) } : {}),
    })
    chain.push(section)
    previous = section
  }

  return chain
}

/** Two sections that reference each other, to exercise circular handling. */
export const circularPair = async (): Promise<{ a: Handle; b: Handle }> => {
  let a = await createSection({ name: uniqueValue("circular-a") })
  let b = await createSection({ name: uniqueValue("circular-b") })

  a = await a.update({ sections: connect(b) })
  b = await b.update({ sections: connect(a) })

  return { a, b }
}
