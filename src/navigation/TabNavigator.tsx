import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Telas principais
import HomeScreen from '../screens/HomeScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import CalendarScreen from '../screens/CalendarScreen';
import SettingsScreen from '../screens/SettingsScreen';

// Tela de Onboarding
import OnboardingScreen from '../screens/OnboardingScreen';
import DashboardScreen from "../screens/Dashboard";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// 1. Seu TabNavigator original permanece intacto
export function TabNavigator() {
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
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Lançamentos" component={TransactionsScreen} />
            <Tab.Screen name="Dashboard" component={DashboardScreen} />
            <Tab.Screen name="Calendário" component={CalendarScreen} />
            <Tab.Screen name="Ajustes" component={SettingsScreen} />
        </Tab.Navigator>
    );
}

// 2. Componente principal de Rotas que gerencia o fluxo inicial
export default function AppRoutes() {
    const [isLoading, setIsLoading] = useState(true);
    const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

    useEffect(() => {
        async function checkOnboarding() {
            try {
                // Checa no dispositivo se o usuário já passou pelo onboarding
                const value = await AsyncStorage.getItem('@has_seen_onboarding');
                setHasSeenOnboarding(value === 'true');
            } catch (error) {
                console.error('Erro ao checar status do onboarding:', error);
                setHasSeenOnboarding(false);
            } finally {
                setIsLoading(false);
            }
        }

        checkOnboarding();
    }, []);

    // Tela de carregamento enquanto consulta o AsyncStorage
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2b2d42" />
            </View>
        );
    }

    return (
        <Stack.Navigator
            initialRouteName={hasSeenOnboarding ? 'MainApp' : 'Onboarding'}
            screenOptions={{ headerShown: false }}
        >
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="MainApp" component={TabNavigator} />
        </Stack.Navigator>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
});