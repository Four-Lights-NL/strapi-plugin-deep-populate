import type { Data, UID } from "@strapi/strapi"

type PopulateType = Record<string, "*" | { populate: unknown } | { on: Record<`${string}.${string}`, unknown> }>
type PopulateBaseProps<TContentType extends UID.ContentType, TSchema extends UID.Schema> = {
  mainUid: TContentType
  mainDocumentId: string
  schema: TSchema
  populate?: Any<TContentType>
  lookup?: string[]
  omitEmpty?: boolean
}

export type PopulateComponentProps<
  TContentType extends UID.ContentType,
  TSchema extends UID.Schema,
> = PopulateBaseProps<TContentType, TSchema> & { inDynamicZone?: boolean }

export type PopulateDynamicZoneProps<TContentType extends UID.ContentType> = Omit<
  PopulateBaseProps<TContentType, UID.Schema>,
  "schema"
> & { components: `${string}.${string}`[] }

export type PopulateRelationProps<TContentType extends UID.ContentType> = {
  contentType: TContentType
  relation: Data.Entity<TContentType> | Data.Entity<TContentType>[]
  resolvedRelations: Map<string, PopulateType>
  omitEmpty: boolean
}

export type PopulateProps<TContentType extends UID.ContentType, TSchema extends UID.Schema> = PopulateBaseProps<
  TContentType,
  TSchema
> & {
  resolvedRelations?: Map<string, PopulateType>
}
