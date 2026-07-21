import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../config/supabaseClient';

// Garante o fechamento automático da janela no navegador ao retornar do login
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const [loading, setLoading] = React.useState(false);

    // Define a URL de redirecionamento do aplicativo
    const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'seuapp', // Adicione 'scheme': 'seuapp' no seu app.json caso use build nativa/standalone
    });

    async function handleGoogleLogin() {
        try {
            setLoading(true);

            // Solicita a URL de autenticação do Google via Supabase
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
                },
            });

            if (error) throw error;
            if (!data?.url) throw new Error('Não foi possível gerar a URL de login.');

            // Abre a janela do navegador para o usuário fazer o login no Google
            const result = await WebBrowser.openAuthSessionAsync(
                data.url,
                redirectUrl
            );

            if (result.type === 'success' && result.url) {
                // Extrai os tokens do callback de resposta
                const params = new URLSearchParams(result.url.split('#')[1] || result.url.split('?')[1]);
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');

                if (accessToken && refreshToken) {
                    // Registra a sessão no Supabase
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });

                    if (sessionError) throw sessionError;
                }
            }
        } catch (err: any) {
            Alert.alert('Erro ao realizar login', err.message || 'Ocorreu um erro.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Bem-vindo ao App</Text>
            <Text style={styles.subtitle}>Gerencie suas finanças de forma simples</Text>

            <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleLogin}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#000" />
                ) : (
                    <>
                        <Ionicons name="logo-google" size={20} color="#000" style={styles.icon} />
                        <Text style={styles.googleButtonText}>Entrar com o Google</Text>
                    </>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#f8f9fa',
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 40,
        textAlign: 'center',
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#ddd',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        width: '100%',
        maxWidth: 300,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    icon: {
        marginRight: 10,
    },
    googleButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
});