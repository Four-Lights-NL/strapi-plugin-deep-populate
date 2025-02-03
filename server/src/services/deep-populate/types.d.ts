import type { Data, UID } from "@strapi/strapi"

type PopulateType = Record<string, "*" | { populate: unknown } | { on: Record<`${string}.${string}`, unknown> }> | true

type PopulateInternalProps = {
  resolvedRelations: Map<string, PopulateType>
  omitEmpty?: boolean
}
type PopulateBaseProps<TContentType extends UID.ContentType, TSchema extends UID.Schema> = PopulateInternalProps & {
  mainUid: TContentType
  mainDocumentId: string
  schema: TSchema
  populate?: Any<TContentType>
  lookup?: string[]
}

export type PopulateComponentProps<
  TContentType extends UID.ContentType,
  TSchema extends UID.Schema,
> = PopulateBaseProps<TContentType, TSchema> & { inDynamicZone?: boolean }

export type PopulateDynamicZoneProps<TContentType extends UID.ContentType> = Omit<
  PopulateBaseProps<TContentType, UID.Schema>,
  "schema"
> & { components: `${string}.${string}`[] }

export type PopulateRelationProps<TContentType extends UID.ContentType> = PopulateInternalProps & {
  contentType: TContentType
  relation: Data.Entity<TContentType> | Data.Entity<TContentType>[]
}

export type PopulateProps<TContentType extends UID.ContentType, TSchema extends UID.Schema> = Omit<
  PopulateBaseProps<TContentType, TSchema>,
  "resolvedRelations"
> & {
  resolvedRelations?: Map<string, PopulateType>
}
