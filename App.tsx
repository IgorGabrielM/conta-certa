import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { NavigationContainer } from '@react-navigation/native';
import { supabase } from './src/config/supabaseClient';
import LoginScreen from './src/screens/LoginScreen';
import TabNavigator from './src/navigation/TabNavigator';

export default function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Busca a sessão armazenada
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // 2. Escuta mudanças de estado de login/logout
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
        <NavigationContainer>
            {session ? <TabNavigator /> : <LoginScreen />}
        </NavigationContainer>
    );
}