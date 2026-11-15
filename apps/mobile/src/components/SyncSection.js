import { useEffect } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as Google from 'expo-auth-session/providers/google'

import { usePlants } from '../state/PlantsContext.js'
import { useTheme } from '../theme/ThemeContext.js'

// Lets the auth sheet close itself and hand control back to the app.
WebBrowser.maybeCompleteAuthSession()

// Set in apps/mobile/.env (EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) after creating the
// iOS OAuth client in Google Cloud for this app's bundle ID. Until then the
// button is disabled and says so, rather than failing with a cryptic error.
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID

// Mirrors the web Settings "Sync across devices" block: signed out = saved only
// on this phone; signed in = backed up and shared with the web app.
export default function SyncSection() {
  const { colors } = useTheme()
  const { cloud } = usePlants()
  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: IOS_CLIENT_ID ?? 'not-configured',
  })

  useEffect(() => {
    if (response?.type === 'success') {
      cloud.signInWithGoogleIdToken(response.params.id_token)
    } else if (response?.type === 'error') {
      cloud.setError("Sign-in didn't work. Please try again.")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response])

  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.text }]}>Sync across devices</Text>
      {cloud.user ? (
        <>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            Synced as {cloud.user.email}. Your plants are shared with the web app.
          </Text>
          <Pressable style={[styles.btn, { borderColor: colors.borderStrong }]} onPress={cloud.signOut}>
            <Text style={[styles.btnText, { color: colors.text }]}>Sign out</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            Your plants are saved only on this phone. Sign in with Google to back them up and use them on the web — entirely optional.
          </Text>
          <Pressable
            style={[styles.btn, { borderColor: colors.borderStrong, opacity: IOS_CLIENT_ID ? 1 : 0.5 }]}
            disabled={!IOS_CLIENT_ID}
            onPress={() => promptAsync()}
          >
            <Text style={[styles.btnText, { color: colors.text }]}>Sign in with Google</Text>
          </Pressable>
          {!IOS_CLIENT_ID && (
            <Text style={[styles.body, { color: colors.textMuted }]}>Sign-in isn't set up in this build yet.</Text>
          )}
        </>
      )}
      {cloud.error && <Text style={[styles.body, { color: colors.danger }]}>{cloud.error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { marginTop: 28, borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  title: { fontSize: 15, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  btn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
})
