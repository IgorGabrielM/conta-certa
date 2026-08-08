import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { supabase } from './src/config/supabaseClient';
import AuthNavigator from './src/navigation/AuthNavigator';
import TabNavigator from './src/navigation/TabNavigator';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from '@vercel/analytics/react';

const queryClient = new QueryClient();

const formatRouteToPath = (routeName: string) => {
    return '/' + routeName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, '-');
};

export default function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    // 1. Tipagem explícita no hook para destravar a inferência do TS
    const navigationRef = useNavigationContainerRef<{ [key: string]: undefined }>();
    const routeNameRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setLoading(false);
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#2b2d42" />
            </View>
        );
    }

    return (
        <QueryClientProvider client={queryClient}>
            <NavigationContainer
                ref={navigationRef}
                onReady={() => {
                    // Agora o TypeScript reconhece a propriedade 'name'
                    const currentRouteName = navigationRef.getCurrentRoute()?.name;
                    routeNameRef.current = currentRouteName;

                    if (currentRouteName && typeof window !== 'undefined' && window.history) {
                        const path = formatRouteToPath(currentRouteName);
                        window.history.replaceState({}, '', path);
                    }
                }}
                onStateChange={() => {
                    const previousRouteName = routeNameRef.current;
                    const currentRouteName = navigationRef.getCurrentRoute()?.name;

                    if (previousRouteName !== currentRouteName && currentRouteName) {
                        if (typeof window !== 'undefined' && window.history) {
                            const path = formatRouteToPath(currentRouteName);
                            window.history.pushState({}, '', path);
                        }
                    }

                    routeNameRef.current = currentRouteName;
                }}
            >
                {session ? <TabNavigator /> : <AuthNavigator />}
            </NavigationContainer>
            <Toast />
            <Analytics />
        </QueryClientProvider>
    );
}