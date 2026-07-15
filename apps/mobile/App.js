import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ThemeProvider, useTheme } from './src/theme/ThemeContext.js'
import { PlantsProvider } from './src/state/PlantsContext.js'
import HomeScreen from './src/screens/HomeScreen.js'
import PlantDetailScreen from './src/screens/PlantDetailScreen.js'

const Stack = createNativeStackNavigator()

function Navigation() {
  const { mode } = useTheme()
  return (
    <NavigationContainer>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="PlantDetail" component={PlantDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PlantsProvider>
          <Navigation />
        </PlantsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
