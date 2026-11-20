import type { Data, Modules, UID } from "@strapi/strapi"

import type { ContentTypeConfigAllow, ContentTypeConfigDeny, DeepPopulateSchemaConfig } from "../../config"

type PopulateType = Record<string, "*" | { populate: unknown } | { on: Record<`${string}.${string}`, unknown> }> | true

type PopulateInternalProps = {
  resolvedRelations: Map<string, PopulateType>
  resolvedSchemas: Set<UID.Schema>
  schemaConfig: Record<string, DeepPopulateSchemaConfig>
  /**
   * Root-scoped static/global fallback, inherited by every level. Schema-level `pluginOptions`
   * are resolved per level on top of this.
   */
  omitEmpty?: boolean
  localizations?: boolean
  /** Explicit function parameters. These take precedence over every schema-level option. */
  omitEmptyOverride?: boolean
  localizationsOverride?: boolean
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
> = PopulateBaseProps<TContentType, TSchema> & {
  inDynamicZone?: boolean
  attrName: string
  /**
   * When the component is the target of a component attribute, the attribute's own allow/deny
   * applies to the component's subtree, not to the component itself. For dynamic zone members the
   * target does need to be checked against the dynamic zone's options.
   */
  allowTargetCheck?: boolean
}

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
  "resolvedRelations" | "resolvedSchemas" | "schemaConfig"
> & {
  resolvedRelations?: Map<string, PopulateType>
  resolvedSchemas?: Set<UID.Schema>
  schemaConfig?: Record<string, DeepPopulateSchemaConfig>
}
