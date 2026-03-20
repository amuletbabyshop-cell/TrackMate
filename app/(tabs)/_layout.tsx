import React, { useRef } from 'react'
import { Animated, TouchableOpacity, Platform } from 'react-native'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Sounds, unlockAudio } from '../../lib/sounds'
import { triggerHomeScroll } from '../../lib/homeScroll'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function tabIcon(name: IoniconsName, focusedName: IoniconsName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : name} size={24} color={color} />
  )
}

function AnimatedTabButton({ children, onPress, accessibilityState, style }: any) {
  const scale = useRef(new Animated.Value(1)).current
  const handlePress = () => {
    unlockAudio()
    if (Platform.OS === 'web') Sounds.tabSwitch()
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.80, useNativeDriver: true, tension: 500, friction: 8 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 180, friction: 6 }),
    ]).start()
    onPress?.()
  }
  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, style]}
      activeOpacity={1}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  )
}

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const bottomPad = Math.max(insets.bottom, 8)

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#555555',
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          paddingBottom: bottomPad,
          height: 52 + bottomPad,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
        headerStyle: { backgroundColor: '#000000' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { color: '#FFFFFF', fontWeight: '800', letterSpacing: -0.3 },
        tabBarButton: (props) => <AnimatedTabButton {...props} />,
      }}
    >
      {/* ── 表示タブ (4つ) ── */}
      <Tabs.Screen
        name="index"
        listeners={({ navigation }) => ({
          tabPress: () => { if (navigation.isFocused()) triggerHomeScroll() },
        })}
        options={{
          title: 'ホーム',
          tabBarIcon: tabIcon('home-outline', 'home'),
        }}
      />
      <Tabs.Screen
        name="notebook"
        options={{
          title: '練習',
          tabBarIcon: tabIcon('barbell-outline', 'barbell'),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'カレンダー',
          tabBarIcon: tabIcon('calendar-outline', 'calendar'),
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: 'チーム',
          tabBarIcon: tabIcon('people-outline', 'people'),
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: 'マイページ',
          tabBarIcon: tabIcon('person-circle-outline', 'person-circle'),
        }}
      />

      {/* ── 非表示タブ（タブバーに出さないが route として有効） ── */}
      {(['records','nutrition','competition','sleep'] as const).map(name => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
        />
      ))}
    </Tabs>
  )
}
