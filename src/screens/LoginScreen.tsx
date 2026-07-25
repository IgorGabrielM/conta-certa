import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../config/supabaseClient';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleLogin() {
        if (!email || !password) {
            Alert.alert('Atenção', 'Por favor, preencha e-mail e senha.');
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (error) throw error;
        } catch (err: any) {
            Alert.alert('Erro ao entrar', err.message || 'E-mail ou senha incorretos.');
        } finally {
            setLoading(false);
        }
    }

    async function handleGoogleLogin() {
        try {
            setLoading(true);
            const redirectUrl = AuthSession.makeRedirectUri({
                scheme: 'contacerta',
                path: 'auth/callback',
            });

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: Platform.OS !== 'web',
                },
            });

            if (error) throw error;

            if (Platform.OS !== 'web' && data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

                if (result.type === 'success' && result.url) {
                    const params = new URLSearchParams(
                        result.url.split('#')[1] || result.url.split('?')[1]
                    );
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');

                    if (accessToken && refreshToken) {
                        await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                    }
                }
            }
        } catch (err: any) {
            Alert.alert('Erro ao realizar login', err.message || 'Ocorreu um erro.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.container}>
                <Text style={styles.title}>Conta Certa</Text>
                <Text style={styles.subtitle}>Gerencie suas finanças de forma simples</Text>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>E-mail</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="seu@email.com"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Senha</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Entrar</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.dividerContainer}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OU</Text>
                    <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                    style={styles.googleButton}
                    onPress={handleGoogleLogin}
                    disabled={loading}
                >
                    <Ionicons name="logo-google" size={18} color="#000" style={{ marginRight: 10 }} />
                    <Text style={styles.googleButtonText}>Entrar com o Google</Text>
                </TouchableOpacity>

                {/* Link para navegar para o Cadastro */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Ainda não tem uma conta? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                        <Text style={styles.footerLink}>Cadastre-se</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContainer: { flexGrow: 1, backgroundColor: '#f8f9fa' },
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
    },
    title: { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center' },
    subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, marginTop: 4 },
    form: { marginBottom: 16 },
    inputGroup: { marginBottom: 14 },
    label: { fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 6 },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ced4da',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#333',
    },
    primaryButton: {
        backgroundColor: '#2b2d42',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    primaryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#dee2e6' },
    dividerText: { marginHorizontal: 12, fontSize: 12, color: '#adb5bd', fontWeight: 'bold' },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#ced4da',
        paddingVertical: 12,
        borderRadius: 8,
    },
    googleButtonText: { fontSize: 14, fontWeight: '600', color: '#333' },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
    footerText: { color: '#666', fontSize: 14 },
    footerLink: { color: '#2b2d42', fontWeight: 'bold', fontSize: 14 },
});