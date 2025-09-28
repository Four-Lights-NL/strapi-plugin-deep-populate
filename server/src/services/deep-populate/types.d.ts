import type { Data, Modules, UID } from "@strapi/strapi"
import type { ContentTypeConfigAllow, ContentTypeConfigDeny } from "../../config"

type PopulateType = Record<string, "*" | { populate: unknown } | { on: Record<`${string}.${string}`, unknown> }> | true

type PopulateInternalProps = {
  initialContentType: UID.ContentType
  resolvedRelations: Map<string, PopulateType>
  omitEmpty?: boolean
  localizations?: boolean
  __deny?: ContentTypeConfigDeny
  __allow?: ContentTypeConfigAllow
}
type PopulateBaseProps<TContentType extends UID.ContentType, TSchema extends UID.Schema> = PopulateInternalProps &
  Modules.Documents.Params.Pick<TContentType, "locale:string" | "status"> & {
    contentType: TContentType
    documentId: string
    schema: TSchema
    populate?: Any<TContentType>
    lookup?: string[]
  }

export type PopulateComponentProps<
  TContentType extends UID.ContentType,
  TSchema extends UID.Schema,
> = PopulateBaseProps<TContentType, TSchema> & { inDynamicZone?: boolean; attrName: string }

export type PopulateDynamicZoneProps<TContentType extends UID.ContentType> = Omit<
  PopulateBaseProps<TContentType, UID.Schema>,
  "schema"
> & { components: UID.Component[]; attrName: string }

export type PopulateRelationProps<TContentType extends UID.ContentType> = PopulateInternalProps &
  Modules.Documents.Params.Pick<TContentType, "locale:string" | "status"> & {
    contentType: TContentType
    relation: Data.Entity<TContentType> | Data.Entity<TContentType>[]
  }

export type PopulateProps<TContentType extends UID.ContentType, TSchema extends UID.Schema> = Omit<
  PopulateBaseProps<TContentType, TSchema>,
  "resolvedRelations",
  "initialContentType"
> & {
  resolvedRelations?: Map<string, PopulateType>
  initialContentType?: UID.ContentType
}
