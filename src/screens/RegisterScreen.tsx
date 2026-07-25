import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message'; // 👈 Importado aqui
import { supabase } from '../config/supabaseClient';

export default function RegisterScreen({ navigation }: any) {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleRegister() {
        if (!fullName || !email || !password) {
            Alert.alert('Atenção', 'Por favor, preencha todos os campos.');
            return;
        }

        try {
            setLoading(true);
            const { error, data } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    data: { full_name: fullName },
                },
            });

            if (error) throw error;

            // 1. Se o Supabase logar direto (sem confirmação de e-mail)
            if (data.session) {
                Toast.show({
                    type: 'success',
                    text1: 'Conta criada com sucesso! 🎉',
                    text2: 'Seja bem-vindo ao Conta Certa.',
                    position: 'top',
                    visibilityTime: 3000,
                });
                // O App.tsx detectará o data.session e alternará para o TabNavigator automaticamente!
            } else {
                // 2. Fallback: Se por acaso exigir login
                Toast.show({
                    type: 'success',
                    text1: 'Conta criada! 👏',
                    text2: 'Faça login para continuar.',
                    position: 'top',
                    visibilityTime: 3000,
                });
                navigation.navigate('Login');
            }
        } catch (err: any) {
            Toast.show({
                type: 'error',
                text1: 'Erro ao cadastrar',
                text2: err.message || 'Não foi possível criar a conta.',
                position: 'top',
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.container}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
                </TouchableOpacity>

                <Text style={styles.title}>Criar Conta</Text>
                <Text style={styles.subtitle}>Preencha os dados abaixo para se cadastrar</Text>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nome Completo</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ex: João Silva"
                            value={fullName}
                            onChangeText={setFullName}
                            autoCapitalize="words"
                        />
                    </View>

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
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Cadastrar</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Já tem uma conta? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                        <Text style={styles.footerLink}>Entrar</Text>
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
    backButton: { marginBottom: 20 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a' },
    subtitle: { fontSize: 14, color: '#666', marginBottom: 24, marginTop: 4 },
    form: { marginBottom: 20 },
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
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
    footerText: { color: '#666', fontSize: 14 },
    footerLink: { color: '#2b2d42', fontWeight: 'bold', fontSize: 14 },
});