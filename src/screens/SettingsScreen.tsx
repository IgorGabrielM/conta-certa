import React, {useState, useEffect} from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
    Modal,
    TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from '../config/supabaseClient';
import {User} from '@supabase/supabase-js';

const PAYDAY_STORAGE_KEY = '@user_payday';

export default function SettingsScreen() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(false);

    // Estados para o Dia de Recebimento
    const [payDay, setPayDay] = useState<number>(1);
    const [modalVisible, setModalVisible] = useState(false);
    const [tempPayDay, setTempPayDay] = useState('');

    useEffect(() => {
        // Busca os dados do usuário autenticado
        supabase.auth.getUser().then(({data: {user}}) => {
            setUser(user);
        });

        loadPayDay();
    }, []);

    async function loadPayDay() {
        try {
            const savedPayDay = await AsyncStorage.getItem(PAYDAY_STORAGE_KEY);
            if (savedPayDay) {
                setPayDay(parseInt(savedPayDay, 10));
            }
        } catch (err) {
            console.error('Erro ao carregar dia de pagamento:', err);
        }
    }

    async function handleSavePayDay() {
        const dayNumber = parseInt(tempPayDay, 10);

        if (isNaN(dayNumber) || dayNumber < 1 || dayNumber > 31) {
            Alert.alert('Dia Inválido', 'Por favor, insira um dia entre 1 e 31.');
            return;
        }

        try {
            await AsyncStorage.setItem(PAYDAY_STORAGE_KEY, dayNumber.toString());
            setPayDay(dayNumber);
            setModalVisible(false);
        } catch (err) {
            Alert.alert('Erro', 'Não foi possível salvar o dia de pagamento.');
        }
    }

    function openPayDayModal() {
        setTempPayDay(payDay.toString());
        setModalVisible(true);
    }

    async function handleLogout() {
        try {
            setLoading(true);
            const {error} = await supabase.auth.signOut();
            if (error) throw error;
        } catch (err: any) {
            Alert.alert('Erro', err.message || 'Erro ao tentar sair.');
        } finally {
            setLoading(false);
        }
    }

    function confirmLogout() {
        if (Platform.OS === 'web') {
            const confirmed = window.confirm('Tem certeza que deseja sair da conta?');
            if (confirmed) {
                handleLogout();
            }
            return;
        }

        Alert.alert(
            'Sair da Conta',
            'Tem certeza que deseja encerrar a sessão?',
            [
                {text: 'Cancelar', style: 'cancel'},
                {text: 'Sair', style: 'destructive', onPress: handleLogout},
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
                        <Ionicons name="person" size={28} color="#fff"/>
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>
                            {user.user_metadata?.full_name || 'Usuário'}
                        </Text>
                        <Text style={styles.userEmail}>{user.email}</Text>
                    </View>
                </View>
            )}

            {/* Seção Preferências */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Preferências</Text>

                <TouchableOpacity
                    style={styles.itemButton}
                    onPress={openPayDayModal}
                >
                    <View style={styles.itemLeft}>
                        <Ionicons name="calendar-outline" size={22} color="#2b2d42"/>
                        <View style={{marginLeft: 10}}>
                            <Text style={styles.itemTitle}>Dia de Recebimento</Text>
                            <Text style={styles.itemSub}>Dia do mês que você recebe seu salário</Text>
                        </View>
                    </View>
                    <View style={styles.itemRight}>
                        <Text style={styles.badgeText}>Dia {payDay}</Text>
                        <Ionicons name="chevron-forward" size={18} color="#8d99ae"/>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Seção Conta */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Conta</Text>

                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={confirmLogout}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#c62828"/>
                    ) : (
                        <>
                            <View style={styles.logoutLeft}>
                                <Ionicons name="log-out-outline" size={22} color="#c62828"/>
                                <Text style={styles.logoutText}>Sair da conta</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#c62828"/>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Modal para Alterar o Dia de Pagamento */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Dia do Recebimento 💰</Text>
                        <Text style={styles.modalSub}>
                            Informe em qual dia do mês você recebe seu salário/renda principal.
                        </Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Ex: 5 ou 20"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            maxLength={2}
                            value={tempPayDay}
                            onChangeText={setTempPayDay}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={{color: '#555'}}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.saveBtn} onPress={handleSavePayDay}>
                                <Text style={{color: '#fff', fontWeight: 'bold'}}>Salvar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#888',
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 4,
    },
    itemButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eee',
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    itemTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    itemSub: {
        fontSize: 11,
        color: '#777',
        marginTop: 2,
    },
    itemRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    badgeText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#2b2d42',
        marginRight: 6,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
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

// Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
    },
    modalTitle: {fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 6},
    modalSub: {fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 18},
    modalInput: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 20,
    },
    cancelBtn: {padding: 10, marginRight: 10},
    saveBtn: {
        backgroundColor: '#2b2d42',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
});