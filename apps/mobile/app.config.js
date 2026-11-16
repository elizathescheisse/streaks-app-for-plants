// Extends app.json. Google sign-in on iOS returns to the app through a link
// scheme built from the iOS OAuth client ID ("123-abc.apps.googleusercontent.com"
// → "com.googleusercontent.apps.123-abc"), so it has to be registered in the
// native build. The ID lives in apps/mobile/.env (not committed) — see
// .env.example. Without it the app still builds; sign-in just shows as unavailable.
const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
const reversed = clientId
  ? `com.googleusercontent.apps.${clientId.replace('.apps.googleusercontent.com', '')}`
  : undefined

module.exports = ({ config }) => ({
  ...config,
  ...(reversed ? { scheme: reversed } : {}),
})
