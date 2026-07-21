import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import CalendarScreen from '../screens/CalendarScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ color, size }) => {
                    let iconName: keyof typeof Ionicons.glyphMap = 'wallet';

                    if (route.name === 'Dashboard') {
                        iconName = 'pie-chart';
                    } else if (route.name === 'Lançamentos') {
                        iconName = 'list';
                    } else if (route.name === 'Calendário') {
                        iconName = 'calendar';
                    } else if (route.name === 'Ajustes') {
                        iconName = 'settings-outline';
                    }

                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: '#2b2d42',
                tabBarInactiveTintColor: '#8d99ae',
            })}
        >
            <Tab.Screen name="Dashboard" component={HomeScreen} />
            <Tab.Screen name="Lançamentos" component={TransactionsScreen} />
            <Tab.Screen name="Calendário" component={CalendarScreen} />
            <Tab.Screen name="Ajustes" component={SettingsScreen} />
        </Tab.Navigator>
    );
}