const settingsPolicies = [
  "admin::isAuthenticatedAdmin",
  {
    name: "plugin::content-manager.hasPermissions",
    config: {
      actions: ["plugin::deep-populate.settings.access"],
    },
  },
]

export default {
  type: "admin",
  routes: [
    {
      method: "GET",
      path: "/settings",
      handler: "settings.getSettings",
      config: { policies: settingsPolicies },
    },
    {
      method: "PUT",
      path: "/settings",
      handler: "settings.updateSettings",
      config: { policies: settingsPolicies },
    },
    {
      method: "GET",
      path: "/targets",
      handler: "settings.getTargets",
      config: { policies: settingsPolicies },
    },
  ],
}
