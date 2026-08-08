import React, {useEffect, useState} from 'react';
import {View, ActivityIndicator} from 'react-native';
import {Session} from '@supabase/supabase-js';
import {NavigationContainer} from '@react-navigation/native';
import Toast from 'react-native-toast-message'; // 👈 Importação do Toast
import {supabase} from './src/config/supabaseClient';
import AuthNavigator from './src/navigation/AuthNavigator';
import TabNavigator from './src/navigation/TabNavigator';
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import { Analytics } from '@vercel/analytics/react';

export default function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({data: {session}}) => {
            setSession(session);
            setLoading(false);
        });

        const {data: authListener} = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setLoading(false);
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const queryClient = new QueryClient();

    const getActiveRouteName = (state: any) => {
        if (!state || typeof state.index !== 'number') return null;
        const route = state.routes[state.index];
        if (route.state) {
            return getActiveRouteName(route.state);
        }
        return route.name;
    };

    if (loading) {
        return (
            <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
                <ActivityIndicator size="large" color="#2b2d42"/>
            </View>
        );
    }

    return (
        <>
            <QueryClientProvider client={queryClient}>
                <NavigationContainer
                    onStateChange={(state) => {
                        const currentRouteName = getActiveRouteName(state);
                        if (currentRouteName) {
                            window.history.replaceState(
                                {},
                                '',
                                `/${currentRouteName.toLowerCase()}`
                            );
                        }
                    }}
                >
                    {session ? <TabNavigator/> : <AuthNavigator/>}
                </NavigationContainer>
                <Toast/>
            </QueryClientProvider>
            <Analytics />
        </>
    );
}