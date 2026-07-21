import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabaseClient';
import { User } from '@supabase/supabase-js';

export default function SettingsScreen() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Busca os dados do usuário autenticado
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
        });
    }, []);

    async function handleLogout() {
        try {
            setLoading(true);
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (err: any) {
            Alert.alert('Erro', err.message || 'Erro ao tentar sair.');
        } finally {
            setLoading(false);
        }
    }

    function confirmLogout() {
        // No Navegador Web, usamos confirm() nativo do JS
        if (Platform.OS === 'web') {
            const confirmed = window.confirm('Tem certeza que deseja sair da conta?');
            if (confirmed) {
                handleLogout();
            }
            return;
        }

        // No iOS / Android, usamos o Alert nativo do React Native
        Alert.alert(
            'Sair da Conta',
            'Tem certeza que deseja encerrar a sessão?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Sair', style: 'destructive', onPress: handleLogout },
            ]
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Ajustes</Text>

            {/* Perfil do Usuário */}
            {user && (
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Ionicons name="person" size={28} color="#fff" />
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>
                            {user.user_metadata?.full_name || 'Usuário'}
                        </Text>
                        <Text style={styles.userEmail}>{user.email}</Text>
                    </View>
                </View>
            )}

            {/* Botão Sair */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Conta</Text>

                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={confirmLogout}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#c62828" />
                    ) : (
                        <>
                            <View style={styles.logoutLeft}>
                                <Ionicons name="log-out-outline" size={22} color="#c62828" />
                                <Text style={styles.logoutText}>Sair da conta</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#c62828" />
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginTop: 20,
        marginBottom: 20,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 25,
        borderWidth: 1,
        borderColor: '#eee',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#2b2d42',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    userEmail: {
        fontSize: 13,
        color: '#777',
        marginTop: 2,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#888',
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 4,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ffebee',
    },
    logoutLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoutText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#c62828',
        marginLeft: 10,
    },
});