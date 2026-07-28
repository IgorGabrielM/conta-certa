import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    LayoutAnimation,
    UIManager,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../config/supabaseClient';
import { Transaction, TransactionType } from '../types/transaction';
import {
    getMergedCategories,
    saveCustomCategoryLocally,
    CategoryItem,
} from '../services/categoryService';
import AdBanner from "../components/AdBanner";
import AdBannerNative from "../components/AdBanner.native";

// Habilita suporte ao LayoutAnimation no Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function TransactionsScreen() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'DONE'>('ALL');

    const [modalVisible, setModalVisible] = useState(false);
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<TransactionType>('Saída');

    const [categoryInput, setCategoryInput] = useState('');
    const [availableCategories, setAvailableCategories] = useState<CategoryItem[]>([]);
    const [filteredCategories, setFilteredCategories] = useState<CategoryItem[]>([]);
    const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);

    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    // 🔄 Recarrega os lançamentos toda vez que a tela ganha foco
    useFocusEffect(
        useCallback(() => {
            fetchTransactions();
        }, [])
    );

    useEffect(() => {
        if (modalVisible) {
            loadCategories();
        }
    }, [type, modalVisible]);

    async function loadCategories() {
        const categories = await getMergedCategories(type);
        setAvailableCategories(categories);
        setFilteredCategories(categories);
    }

    const handleCategoryInputChange = (text: string) => {
        setCategoryInput(text);
        if (text.trim() === '') {
            setFilteredCategories(availableCategories);
        } else {
            const matches = availableCategories.filter((c) =>
                c.name.toLowerCase().includes(text.toLowerCase())
            );
            setFilteredCategories(matches);
        }
        setShowCategorySuggestions(true);
    };

    const handleSelectCategory = (categoryName: string) => {
        setCategoryInput(categoryName);
        setShowCategorySuggestions(false);
    };

    async function fetchTransactions() {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) return;

            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('is_completed', { ascending: true })
                .order('due_date', { ascending: false });

            if (error) throw error;
            setTransactions(data || []);
        } catch (err) {
            console.error('Erro ao buscar lançamentos:', err);
        } finally {
            setLoading(false);
        }
    }

    // 🚀 Atualização instantânea com animação (sem reload/loading)
    async function toggleTransactionStatus(item: Transaction) {
        const newStatus = !item.is_completed;
        const newAmountActual = newStatus ? item.amount_expected : null;
        const updatedCompletedAt = newStatus ? new Date().toISOString().split('T')[0] : null;

        // Ativa animação suave para o próximo ciclo de renderização
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        // 1. Atualiza estado local imediatamente e move o item para o final da lista
        setTransactions((prevList) => {
            const updated = prevList.map((t) => {
                if (t.id === item.id) {
                    return {
                        ...t,
                        is_completed: newStatus,
                        amount_actual: newAmountActual,
                        completed_at: updatedCompletedAt,
                    };
                }
                return t;
            });

            // Reordena: Pendentes acima, Concluídas ao final
            return updated.sort((a, b) => {
                if (a.is_completed === b.is_completed) {
                    return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
                }
                return a.is_completed ? 1 : -1;
            });
        });

        // 2. Persiste no Supabase em segundo plano sem disparar loading
        const { error } = await supabase
            .from('transactions')
            .update({
                is_completed: newStatus,
                amount_actual: newAmountActual,
                completed_at: updatedCompletedAt,
            })
            .eq('id', item.id);

        if (error) {
            console.error('Erro ao atualizar no banco:', error);
            fetchTransactions(); // Reverte apenas se falhar
        }
    }

    async function handleCreateTransaction() {
        if (!title || !amount) {
            Alert.alert('Atenção', 'Preencha o nome e o valor.');
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            Alert.alert('Erro', 'Usuário não autenticado.');
            return;
        }

        const formattedCategory = categoryInput.trim() || 'Geral';
        const formattedDate = selectedDate.toISOString().split('T')[0];

        await saveCustomCategoryLocally(formattedCategory, type);

        const { error } = await supabase.from('transactions').insert([
            {
                title,
                type,
                amount_expected: parseFloat(amount.replace(',', '.')),
                due_date: formattedDate,
                category_name: formattedCategory,
                is_completed: false,
                user_id: user.id,
            },
        ]);

        if (!error) {
            setModalVisible(false);
            setTitle('');
            setAmount('');
            setCategoryInput('');
            setSelectedDate(new Date());
            setShowCategorySuggestions(false);
            fetchTransactions();
        } else {
            Alert.alert('Erro ao salvar', error.message);
        }
    }

    async function handleDeleteTransaction(id: string) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setTransactions((prev) => prev.filter((item) => item.id !== id));

        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) fetchTransactions();
    }

    const handleDateChange = (event: any, date?: Date) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (date) setSelectedDate(date);
    };

    const filteredTransactions = transactions.filter((t) => {
        if (filterStatus === 'PENDING') return !t.is_completed;
        if (filterStatus === 'DONE') return t.is_completed;
        return true;
    });

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Lançamentos</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => {
                        setCategoryInput('');
                        setShowCategorySuggestions(false);
                        setModalVisible(true);
                    }}
                >
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Filtros de Exibição */}
            <View style={styles.filterContainer}>
                {(['ALL', 'PENDING', 'DONE'] as const).map((status) => (
                    <TouchableOpacity
                        key={status}
                        style={[
                            styles.filterTab,
                            filterStatus === status && styles.filterTabActive,
                        ]}
                        onPress={() => setFilterStatus(status)}
                    >
                        <Text
                            style={[
                                styles.filterText,
                                filterStatus === status && styles.filterTextActive,
                            ]}
                        >
                            {status === 'ALL' ? 'Todos' : status === 'PENDING' ? 'Pendentes' : 'Concluídos'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Listagem */}
            {loading ? (
                <ActivityIndicator size="large" color="#2b2d42" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={filteredTransactions}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <View style={[styles.card, item.is_completed && styles.cardCompleted]}>
                            <TouchableOpacity
                                style={styles.checkArea}
                                onPress={() => toggleTransactionStatus(item)}
                            >
                                <Ionicons
                                    name={item.is_completed ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={26}
                                    color={item.is_completed ? '#2e7d32' : '#8d99ae'}
                                />
                            </TouchableOpacity>

                            <View style={styles.cardInfo}>
                                <Text
                                    style={[
                                        styles.itemTitle,
                                        item.is_completed && styles.itemTitleCompleted,
                                    ]}
                                >
                                    {item.title}
                                </Text>
                                <Text style={styles.itemSub}>
                                    {item.category_name || 'Sem categoria'} • {item.due_date}
                                </Text>
                            </View>

                            <Text
                                style={[
                                    styles.itemAmount,
                                    { color: item.type === 'Entrada' ? '#2e7d32' : '#c62828' },
                                    item.is_completed && { opacity: 0.5 },
                                ]}
                            >
                                {item.type === 'Entrada' ? '+' : '-'} R${' '}
                                {(item.amount_actual ?? item.amount_expected).toFixed(2)}
                            </Text>

                            <TouchableOpacity
                                onPress={() => handleDeleteTransaction(item.id)}
                                style={styles.deleteBtn}
                            >
                                <Ionicons name="trash-outline" size={18} color="#c62828" />
                            </TouchableOpacity>
                        </View>
                    )}
                />
            )}

            {/* Modal Principal de Criação */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowCategorySuggestions(false)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        style={styles.modalContent}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <Text style={styles.modalTitle}>Novo Lançamento</Text>

                        {/* Campo 1: Tipo */}
                        <Text style={styles.label}>Tipo de Lançamento</Text>
                        <View style={styles.typeRow}>
                            {(['Saída', 'Entrada'] as const).map((t) => (
                                <TouchableOpacity
                                    key={t}
                                    style={[
                                        styles.typeBtn,
                                        type === t && {
                                            backgroundColor: t === 'Entrada' ? '#2e7d32' : '#c62828',
                                        },
                                    ]}
                                    onPress={() => {
                                        setType(t);
                                        setShowCategorySuggestions(false);
                                    }}
                                >
                                    <Text style={{ color: type === t ? '#fff' : '#333', fontWeight: 'bold' }}>
                                        {t}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Campo 2: Nome */}
                        <Text style={styles.label}>Nome</Text>
                        <TextInput
                            placeholder="Ex: Aluguel, Mercado, Salário"
                            placeholderTextColor="#999"
                            style={styles.input}
                            value={title}
                            onChangeText={setTitle}
                            onFocus={() => setShowCategorySuggestions(false)}
                        />

                        {/* Campo 3: Valor */}
                        <Text style={styles.label}>Valor (R$)</Text>
                        <TextInput
                            placeholder="Ex: 150.00"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            style={styles.input}
                            value={amount}
                            onChangeText={setAmount}
                            onFocus={() => setShowCategorySuggestions(false)}
                        />

                        {/* Campo 4: Autocomplete Categoria */}
                        <Text style={styles.label}>Categoria (Digite ou escolha)</Text>
                        <View style={styles.autocompleteWrapper}>
                            <TouchableOpacity
                                activeOpacity={1}
                                onPress={() => {
                                    const text = categoryInput.trim();
                                    if (!text) {
                                        setFilteredCategories(availableCategories);
                                    } else {
                                        const matches = availableCategories.filter((c) =>
                                            c.name.toLowerCase().includes(text.toLowerCase())
                                        );
                                        setFilteredCategories(matches);
                                    }
                                    setShowCategorySuggestions(true);
                                }}
                            >
                                <TextInput
                                    placeholder="Ex: Alimentação, Transporte"
                                    placeholderTextColor="#999"
                                    style={styles.input}
                                    value={categoryInput}
                                    onChangeText={handleCategoryInputChange}
                                    onFocus={() => {
                                        const text = categoryInput.trim();
                                        if (!text) {
                                            setFilteredCategories(availableCategories);
                                        } else {
                                            const matches = availableCategories.filter((c) =>
                                                c.name.toLowerCase().includes(text.toLowerCase())
                                            );
                                            setFilteredCategories(matches);
                                        }
                                        setShowCategorySuggestions(true);
                                    }}
                                />
                            </TouchableOpacity>

                            {/* Sugestões do Autocomplete */}
                            {showCategorySuggestions && (
                                <View style={styles.suggestionsContainer}>
                                    {filteredCategories.length > 0 ? (
                                        <ScrollView
                                            style={{ maxHeight: 140 }}
                                            nestedScrollEnabled={true}
                                            keyboardShouldPersistTaps="always"
                                        >
                                            {filteredCategories.map((cat) => (
                                                <TouchableOpacity
                                                    key={cat.id}
                                                    style={styles.suggestionItem}
                                                    onPress={() => handleSelectCategory(cat.name)}
                                                >
                                                    <Text style={styles.suggestionText}>{cat.name}</Text>
                                                    {cat.isCustom && (
                                                        <Text style={styles.customBadge}>Criada por você</Text>
                                                    )}
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    ) : (
                                        <View style={styles.suggestionItem}>
                                            <Text style={{ fontSize: 12, color: '#888' }}>
                                                Nova categoria será criada ao salvar.
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Campo 5: Data */}
                        <Text style={styles.label}>Data de Vencimento</Text>
                        {Platform.OS === 'web' ? (
                            <input
                                type="date"
                                value={selectedDate.toISOString().split('T')[0]}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        setSelectedDate(new Date(e.target.value + 'T00:00:00'));
                                    }
                                }}
                                style={styles.webDateInput}
                            />
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={styles.selectorButton}
                                    onPress={() => {
                                        setShowCategorySuggestions(false);
                                        setShowDatePicker(true);
                                    }}
                                >
                                    <Text style={styles.selectorButtonText}>
                                        {selectedDate.toLocaleDateString('pt-BR')}
                                    </Text>
                                    <Ionicons name="calendar-outline" size={20} color="#555" />
                                </TouchableOpacity>

                                {showDatePicker && (
                                    <DateTimePicker
                                        value={selectedDate}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                                        onChange={handleDateChange}
                                    />
                                )}
                            </>
                        )}

                        {/* Botões Ação */}
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={{ color: '#555' }}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.saveBtn} onPress={handleCreateTransaction}>
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Salvar</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
            {/*
            {
                Platform.OS !== 'web' ? <AdBannerNative /> : <></>
            }
            */}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 15,
    },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a' },
    addButton: { backgroundColor: '#2b2d42', padding: 10, borderRadius: 10 },
    filterContainer: { flexDirection: 'row', marginBottom: 15 },
    filterTab: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#e0e0e0',
        marginRight: 8,
    },
    filterTabActive: { backgroundColor: '#2b2d42' },
    filterText: { color: '#555', fontSize: 12, fontWeight: '600' },
    filterTextActive: { color: '#fff' },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#eee',
    },
    cardCompleted: {
        backgroundColor: '#f1f3f5',
        borderColor: '#e9ecef',
    },
    checkArea: { marginRight: 10 },
    cardInfo: { flex: 1 },
    itemTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
    itemTitleCompleted: {
        textDecorationLine: 'line-through',
        color: '#8d99ae',
    },
    itemSub: { fontSize: 12, color: '#777', marginTop: 2 },
    itemAmount: { fontSize: 15, fontWeight: 'bold', marginRight: 10 },
    deleteBtn: { padding: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '88%', backgroundColor: '#fff', borderRadius: 16, padding: 20, overflow: 'visible' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    label: { fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 4, marginTop: 8 },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
    typeRow: { flexDirection: 'row', justifyContent: 'space-between' },
    typeBtn: {
        flex: 1,
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 2,
        backgroundColor: '#eee',
    },
    autocompleteWrapper: {
        position: 'relative',
        zIndex: 9999,
        elevation: 10,
    },
    suggestionsContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ccc',
        marginTop: 4,
        zIndex: 9999,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
    },
    suggestionItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    suggestionText: { fontSize: 14, color: '#333' },
    customBadge: { fontSize: 10, color: '#8d99ae', fontStyle: 'italic' },
    selectorButton: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
    },
    selectorButtonText: {
        fontSize: 14,
        color: '#333',
    },
    webDateInput: {
        width: '100%',
        padding: '10px',
        borderRadius: '8px',
        border: '1px solid #ccc',
        fontSize: '14px',
        boxSizing: 'border-box',
    } as any,
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
});