import React, { useState, useEffect } from 'react';
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
    FlatList,
    Image,
    KeyboardAvoidingView,
    TouchableWithoutFeedback,
    Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabaseClient';
import { User } from '@supabase/supabase-js';

const PAYDAY_STORAGE_KEY = '@user_payday';
const CUSTOM_CATEGORIES_STORAGE_KEY = '@ContaCerta:custom_categories';

interface CategoryItem {
    id: string;
    name: string;
    type: 'income' | 'expense' | 'Entrada' | 'Saída';
    isCustom?: boolean;
}

export default function SettingsScreen() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(false);
    const [imageError, setImageError] = useState(false);

    // Estados para o Dia de Recebimento
    const [payDay, setPayDay] = useState<number>(1);
    const [payDayModalVisible, setPayDayModalVisible] = useState(false);
    const [tempPayDay, setTempPayDay] = useState('');

    // Estados para Gerenciamento de Categorias Locais
    const [categoriesModalVisible, setCategoriesModalVisible] = useState(false);
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
    const [editingName, setEditingName] = useState('');
    const [editingType, setEditingType] = useState<'income' | 'expense'>('expense');

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
        });

        loadPayDay();
    }, []);

    // --- DIA DE RECEBIMENTO ---

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
            setPayDayModalVisible(false);
        } catch (err) {
            Alert.alert('Erro', 'Não foi possível salvar o dia de pagamento.');
        }
    }

    function openPayDayModal() {
        setTempPayDay(payDay.toString());
        setPayDayModalVisible(true);
    }

    // --- GERENCIAMENTO DE CATEGORIAS ---

    async function loadCategories() {
        try {
            const saved = await AsyncStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
            if (saved) {
                setCategories(JSON.parse(saved));
            } else {
                setCategories([]);
            }
        } catch (err) {
            console.error('Erro ao carregar categorias:', err);
        }
    }

    function openCategoriesModal() {
        loadCategories();
        setCategoriesModalVisible(true);
    }

    function handleStartEdit(category: CategoryItem) {
        setEditingCategory(category);
        setEditingName(category.name);
        const currentType = category.type === 'income' || category.type === 'Entrada' ? 'income' : 'expense';
        setEditingType(currentType);
    }

    async function handleSaveEdit() {
        if (!editingCategory || !editingName.trim()) return;

        try {
            const updated = categories.map((cat) =>
                cat.id === editingCategory.id
                    ? { ...cat, name: editingName.trim(), type: editingType }
                    : cat
            );
            await AsyncStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
            setCategories(updated);
            setEditingCategory(null);
            setEditingName('');
        } catch (err) {
            Alert.alert('Erro', 'Não foi possível atualizar a categoria.');
        }
    }

    async function handleDeleteCategory(id: string) {
        const executeDelete = async () => {
            try {
                const updated = categories.filter((cat) => cat.id !== id);
                await AsyncStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
                setCategories(updated);
                if (editingCategory?.id === id) {
                    setEditingCategory(null);
                }
            } catch (err) {
                Alert.alert('Erro', 'Não foi possível excluir a categoria.');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Deseja excluir esta categoria salva?')) {
                executeDelete();
            }
            return;
        }

        Alert.alert('Excluir Categoria', 'Tem certeza que deseja apagar esta categoria?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Excluir', style: 'destructive', onPress: executeDelete },
        ]);
    }

    function getTypeLabel(type: string) {
        return type === 'income' || type === 'Entrada' ? 'Entrada' : 'Saída';
    }

    // --- LOGOUT ---

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
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Sair', style: 'destructive', onPress: handleLogout },
            ]
        );
    }

    const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
    const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'Usuário';

    const visibleCategories = categories.filter(
        (cat) => cat.id !== editingCategory?.id
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Ajustes</Text>

            {/* Perfil do Usuário */}
            {user && (
                <View style={styles.profileCard}>
                    {userAvatar && !imageError ? (
                        <Image
                            source={{
                                uri: userAvatar,
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36',
                                },
                            }}
                            style={styles.avatarImage}
                            onError={() => setImageError(true)}
                        />
                    ) : (
                        <View style={styles.avatar}>
                            <Ionicons name="person" size={28} color="#fff" />
                        </View>
                    )}
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{userName}</Text>
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
                        <Ionicons name="calendar-outline" size={22} color="#2b2d42" />
                        <View style={{ marginLeft: 10 }}>
                            <Text style={styles.itemTitle}>Dia de Recebimento</Text>
                            <Text style={styles.itemSub}>Dia do mês que você recebe seu salário</Text>
                        </View>
                    </View>
                    <View style={styles.itemRight}>
                        <Text style={styles.badgeText}>Dia {payDay}</Text>
                        <Ionicons name="chevron-forward" size={18} color="#8d99ae" />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.itemButton, { marginTop: 10 }]}
                    onPress={openCategoriesModal}
                >
                    <View style={styles.itemLeft}>
                        <Ionicons name="pricetags-outline" size={22} color="#2b2d42" />
                        <View style={{ marginLeft: 10 }}>
                            <Text style={styles.itemTitle}>Categorias Salvas</Text>
                            <Text style={styles.itemSub}>Gerencie suas categorias personalizadas</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#8d99ae" />
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

            {/* Modal Dia de Pagamento */}
            {/* Modal Dia de Pagamento */}
            <Modal visible={payDayModalVisible} transparent animationType="fade">
                {Platform.OS === 'web' ? (
                    // No Web, renderizamos direto sem o TouchableWithoutFeedback para não bloquear o foco do input
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
                                inputMode="numeric" // Força o teclado numérico no Web Mobile
                                maxLength={2}
                                value={tempPayDay}
                                onChangeText={setTempPayDay}
                                autoFocus={Platform.OS === 'web'} // Ajuda a focar automaticamente no Web
                            />

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={styles.cancelBtn}
                                    onPress={() => setPayDayModalVisible(false)}
                                >
                                    <Text style={{ color: '#555' }}>Cancelar</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.saveBtn} onPress={handleSavePayDay}>
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Salvar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ) : (
                    // No iOS / Android mantemos o comportamento com TouchableWithoutFeedback
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalOverlay}>
                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                style={{ width: '100%', alignItems: 'center' }}
                            >
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
                                            onPress={() => setPayDayModalVisible(false)}
                                        >
                                            <Text style={{ color: '#555' }}>Cancelar</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity style={styles.saveBtn} onPress={handleSavePayDay}>
                                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Salvar</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </KeyboardAvoidingView>
                        </View>
                    </TouchableWithoutFeedback>
                )}
            </Modal>

            {/* Modal Gerenciador de Categorias Locais */}
            <Modal visible={categoriesModalVisible} transparent animationType="slide">
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalOverlay}>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={styles.keyboardView}
                        >
                            <View style={styles.categoriesModalContent}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Categorias Salvas 🏷️</Text>
                                    <TouchableOpacity onPress={() => {
                                        setEditingCategory(null);
                                        setCategoriesModalVisible(false);
                                    }}>
                                        <Ionicons name="close" size={24} color="#666" />
                                    </TouchableOpacity>
                                </View>

                                {/* Bloco de Edição */}
                                {editingCategory && (
                                    <View style={styles.editBox}>
                                        <Text style={styles.editTitle}>Editar categoria:</Text>

                                        <TextInput
                                            style={styles.editInput}
                                            value={editingName}
                                            onChangeText={setEditingName}
                                            placeholder="Nome da categoria"
                                        />

                                        <View style={styles.typeSelectorRow}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.typeOptionBtn,
                                                    editingType === 'expense' && styles.typeOptionExpenseActive,
                                                ]}
                                                onPress={() => setEditingType('expense')}
                                            >
                                                <Text
                                                    style={{
                                                        color: editingType === 'expense' ? '#fff' : '#333',
                                                        fontSize: 12,
                                                        fontWeight: 'bold',
                                                    }}
                                                >
                                                    Saída
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[
                                                    styles.typeOptionBtn,
                                                    editingType === 'income' && styles.typeOptionIncomeActive,
                                                ]}
                                                onPress={() => setEditingType('income')}
                                            >
                                                <Text
                                                    style={{
                                                        color: editingType === 'income' ? '#fff' : '#333',
                                                        fontSize: 12,
                                                        fontWeight: 'bold',
                                                    }}
                                                >
                                                    Entrada
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.editActions}>
                                            <TouchableOpacity
                                                style={styles.cancelBtn}
                                                onPress={() => setEditingCategory(null)}
                                            >
                                                <Text style={{ color: '#555', fontSize: 12 }}>Cancelar</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.saveBtnSmall}
                                                onPress={handleSaveEdit}
                                            >
                                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                                                    Salvar
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                {categories.length === 0 ? (
                                    <Text style={styles.emptyText}>
                                        Nenhuma categoria personalizada salva localmente.
                                    </Text>
                                ) : (
                                    <View style={styles.listContainer}>
                                        <FlatList
                                            data={visibleCategories}
                                            keyExtractor={(item) => item.id}
                                            style={styles.categoriesList}
                                            contentContainerStyle={{ paddingBottom: 10 }}
                                            keyboardShouldPersistTaps="handled"
                                            showsVerticalScrollIndicator={true}
                                            renderItem={({ item }) => {
                                                const label = getTypeLabel(item.type);
                                                return (
                                                    <View style={styles.categoryCard}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.categoryName}>{item.name}</Text>
                                                            <Text
                                                                style={[
                                                                    styles.typeBadge,
                                                                    label === 'Entrada'
                                                                        ? styles.typeEntrada
                                                                        : styles.typeSaida,
                                                                ]}
                                                            >
                                                                {label}
                                                            </Text>
                                                        </View>
                                                        <View style={styles.categoryActions}>
                                                            <TouchableOpacity
                                                                onPress={() => handleStartEdit(item)}
                                                                style={styles.actionIcon}
                                                            >
                                                                <Ionicons name="pencil" size={18} color="#2b2d42" />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                onPress={() => handleDeleteCategory(item.id)}
                                                                style={styles.actionIcon}
                                                            >
                                                                <Ionicons name="trash" size={18} color="#c62828" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                );
                                            }}
                                        />
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.closeBtn}
                                    onPress={() => {
                                        setEditingCategory(null);
                                        setCategoriesModalVisible(false);
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Fechar</Text>
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                </TouchableWithoutFeedback>
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
    avatarImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 14,
        backgroundColor: '#e1e1e1',
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

    // Modais
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyboardView: {
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
    },
    categoriesModalContent: {
        width: '88%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
    },
    listContainer: {
        width: '100%',
    },
    categoriesList: {
        maxHeight: 380, // Define o ponto exato onde para de crescer e vira scroll!
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    modalSub: {
        fontSize: 13,
        color: '#666',
        marginBottom: 16,
        lineHeight: 18,
    },
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
    cancelBtn: {
        padding: 10,
        marginRight: 10,
    },
    saveBtn: {
        backgroundColor: '#2b2d42',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    closeBtn: {
        backgroundColor: '#2b2d42',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 15,
    },

    // Estilos de Categorias Locais
    categoryCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#eee',
    },
    categoryName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    typeBadge: {
        fontSize: 10,
        fontWeight: 'bold',
        marginTop: 2,
        alignSelf: 'flex-start',
    },
    typeEntrada: {
        color: '#2e7d32',
    },
    typeSaida: {
        color: '#c62828',
    },
    categoryActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionIcon: {
        padding: 4,
        marginLeft: 10,
    },
    editBox: {
        backgroundColor: '#f0f2f5',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    editTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#555',
        marginBottom: 8,
    },
    editInput: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        padding: 8,
        fontSize: 14,
        marginBottom: 8,
    },
    typeSelectorRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 4,
    },
    typeOptionBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 6,
        alignItems: 'center',
        backgroundColor: '#e0e0e0',
    },
    typeOptionExpenseActive: {
        backgroundColor: '#c62828',
    },
    typeOptionIncomeActive: {
        backgroundColor: '#2e7d32',
    },
    editActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 8,
        alignItems: 'center',
    },
    saveBtnSmall: {
        backgroundColor: '#2b2d42',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    emptyText: {
        fontSize: 13,
        color: '#999',
        textAlign: 'center',
        marginVertical: 20,
    },
});