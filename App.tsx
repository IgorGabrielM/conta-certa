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

export default function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    const navigationRef = useNavigationContainerRef();
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
                    const currentRoute = navigationRef.getCurrentRoute()?.name;
                    routeNameRef.current = currentRoute;

                    // Sincroniza a rota inicial
                    if (currentRoute && typeof window !== 'undefined' && window.history) {
                        window.history.replaceState({}, '', `/${currentRoute}`);
                    }
                }}
                onStateChange={() => {
                    const previousRouteName = routeNameRef.current;
                    const currentRouteName = navigationRef.getCurrentRoute()?.name;

                    if (previousRouteName !== currentRouteName && currentRouteName) {
                        // Atualiza a URL do ambiente web/browser para a Vercel capturar na seção Pages
                        if (typeof window !== 'undefined' && window.history) {
                            window.history.pushState({}, '', `/${currentRouteName}`);
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