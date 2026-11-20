export const prefixPluginTranslations = (trad: Record<string, string>, pluginId: string) => {
  return Object.keys(trad).reduce<Record<string, string>>((acc, current) => {
    acc[`${pluginId}.${current}`] = trad[current]
    return acc
  }, {})
}
