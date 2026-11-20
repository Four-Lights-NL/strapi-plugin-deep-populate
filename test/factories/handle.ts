import type { UID } from "@strapi/strapi"

import { strapi } from "@test/harness"

/** A relation target: a raw documentId or a factory {@link Handle}. */
export type Ref = string | Handle

/**
 * A chainable handle around a created document. Factories eager-create and
 * return one of these so tests can keep writing instead of re-fetching.
 */
export interface Handle<T extends UID.ContentType = UID.ContentType> {
  /** The content-type UID this handle points at. */
  readonly uid: T
  /** The document's `documentId`. */
  readonly documentId: string
  /** The raw document returned by the create/update call. */
  readonly doc: Record<string, unknown>
  /** `{ connect: [documentId] }`, ready to drop into a relation field. */
  connect(): { connect: string[] }
  /** Update the document and return a fresh handle. */
  update(data: Record<string, unknown>, params?: Record<string, unknown>): Promise<Handle<T>>
  /** Publish the document and return a fresh handle. */
  publish(params?: Record<string, unknown>): Promise<Handle<T>>
  /** Write a localization and return a fresh handle. */
  localize(locale: string, data?: Record<string, unknown>, params?: Record<string, unknown>): Promise<Handle<T>>
  /** Re-read the document and return a fresh handle. */
  refresh(params?: Record<string, unknown>): Promise<Handle<T>>
}

/** Resolve a {@link Ref} to its `documentId`. */
export const toDocumentId = (ref: Ref): string => (typeof ref === "string" ? ref : ref.documentId)

/** Build a Strapi `connect` payload from any mix of ids and handles. */
export const connect = (refs: Ref | Ref[]): { connect: string[] } => ({
  connect: (Array.isArray(refs) ? refs : [refs]).map(toDocumentId),
})

/** Wrap a raw document in a {@link Handle}. */
export const makeHandle = <T extends UID.ContentType>(uid: T, doc: Record<string, unknown>): Handle<T> => {
  const documentId = doc.documentId as string
  const documents = strapi.documents(uid) as unknown as {
    update: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
    publish: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
    findOne: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
  }

  return {
    uid,
    documentId,
    doc,
    connect: () => ({ connect: [documentId] }),
    update: async (data, params = {}) => makeHandle(uid, await documents.update({ documentId, data, ...params })),
    publish: async (params = {}) => makeHandle(uid, await documents.publish({ documentId, ...params })),
    localize: async (locale, data = {}, params = {}) =>
      makeHandle(uid, await documents.update({ documentId, locale, data, ...params })),
    refresh: async (params = {}) => makeHandle(uid, await documents.findOne({ documentId, ...params })),
  }
}
