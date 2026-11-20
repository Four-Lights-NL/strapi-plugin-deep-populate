import { connect, type Ref } from "./handle"

export type SpecialInput = {
  isSpecial?: boolean
  name?: string
  users?: Ref | Ref[]
  linkedSections?: Ref | Ref[]
}

export type CoolComponentInput = {
  isCool?: boolean
  title?: string
  text?: string
  specialSingle?: SpecialInput
  specialRepeatable?: SpecialInput[]
}

export type SliderItemInput = {
  enabled?: boolean
  image?: Record<string, unknown>
  link?: Record<string, unknown>
}

export type SliderInput = {
  items?: SliderItemInput[]
  className?: string
  spacing?: number
  height?: number
}

export type LinkInput = {
  label?: string
  href?: string
  target?: "_blank"
  isExternal?: boolean
  page?: Ref
}

const normalizeSpecial = (input: SpecialInput): Record<string, unknown> => {
  const { users, linkedSections, ...rest } = input
  return {
    ...rest,
    ...(users !== undefined ? { users: connect(users) } : {}),
    ...(linkedSections !== undefined ? { linkedSections: connect(linkedSections) } : {}),
  }
}

/** Build a `cms.special` component input. */
export const special = (input: SpecialInput = {}): Record<string, unknown> => ({
  isSpecial: true,
  ...normalizeSpecial(input),
})

/** Build a `cms.cool-component` component input. */
export const coolComponent = (input: CoolComponentInput = {}): Record<string, unknown> => {
  const { specialSingle, specialRepeatable, ...rest } = input
  return {
    isCool: true,
    ...rest,
    ...(specialSingle !== undefined ? { specialSingle: normalizeSpecial(specialSingle) } : {}),
    ...(specialRepeatable !== undefined ? { specialRepeatable: specialRepeatable.map(normalizeSpecial) } : {}),
  }
}

/** Build a `shared.slider-item` component input. */
export const sliderItem = (input: SliderItemInput = {}): Record<string, unknown> => ({
  enabled: true,
  ...input,
})

/** Build a `cms.slider` component input. */
export const slider = (input: SliderInput = {}): Record<string, unknown> => ({
  items: [],
  ...input,
})

/** Build a `shared.link` component input. */
export const link = (input: LinkInput = {}): Record<string, unknown> => {
  const { page, ...rest } = input
  return {
    label: "link",
    ...rest,
    ...(page !== undefined ? { page: connect(page) } : {}),
  }
}

/** Wrap a component builder's output as a dynamic-zone entry. */
export const asBlock = (component: string, data: Record<string, unknown>): Record<string, unknown> => ({
  __component: component,
  ...data,
})
