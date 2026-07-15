import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

// Local-only reminders — no server, no push token. Scheduled entirely on
// the device (the "wait an hour after watering, then re-measure" reminder).
// Everything here fails soft: if permission is denied or the platform can't
// schedule, logging still works, you just don't get the nudge.

// Show an alert even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

let permissionChecked = false
let permissionGranted = false

export async function ensureNotificationPermission() {
  if (permissionChecked) return permissionGranted
  permissionChecked = true
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    let status = existing
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync()
      status = req.status
    }
    permissionGranted = status === 'granted'

    if (permissionGranted && Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }
  } catch {
    permissionGranted = false
  }
  return permissionGranted
}

// Schedule a "time to re-measure" reminder N minutes after watering.
// Default 60 min matches the app's existing post-watering settle window.
export async function scheduleReMeasureReminder(plantName, minutes = 60) {
  const ok = await ensureNotificationPermission()
  if (!ok) return null
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌿 Time to re-measure',
        body: `${plantName} has had ~${minutes} min to settle after watering. Take a fresh moisture reading.`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: minutes * 60,
      },
    })
  } catch {
    return null
  }
}
