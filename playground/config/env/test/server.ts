export default ({ env }) => ({
  host: "127.0.0.1",
  app: {
    keys: env.array("APP_KEYS", ["SG.testA", "SG.testB"]),
  },
})
