import { Modal, KeyboardAvoidingView, Pressable, View, StyleSheet, Platform } from 'react-native'
import { useTheme } from '../theme/ThemeContext.js'

// Shared bottom-sheet shell for the app's modals. The key job is keyboard
// handling: the sheet is anchored to the bottom, so without KeyboardAvoidingView
// an opened keyboard covers it (and any autoFocus input makes the sheet look
// like it never appeared). Wrapping in KAV with justifyContent:flex-end lifts
// the whole sheet above the keyboard. The scrim is an absolute fill behind the
// sheet so tapping outside closes, while taps on the sheet itself don't.
export default function BottomSheet({ visible, onClose, children }) {
  const { colors } = useTheme()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={[styles.scrim, { backgroundColor: colors.overlayScrim }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.bgElevated }]}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    // Never taller than the space above the keyboard — tall content
    // (e.g. the full log form) scrolls internally instead of clipping.
    maxHeight: '88%',
  },
})
