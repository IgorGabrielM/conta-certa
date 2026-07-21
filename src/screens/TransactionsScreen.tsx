import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../config/supabaseClient';
import { Transaction, Category, TransactionType } from '../types/transaction';

export default function TransactionsScreen() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtro de Exibição na Lista
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'DONE'>('ALL');

    // Modal de Novo Lançamento
    const [modalVisible, setModalVisible] = useState(false);
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<TransactionType>('Saída');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    // Controle do DatePicker (padrão: data atual)
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Modal Seletor de Categoria
    const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);

    useEffect(() => {
        fetchCategories();
        fetchTransactions();
    }, []);

    // Seleciona a primeira categoria compatível ao mudar o tipo (Entrada/Saída)
    useEffect(() => {
        const available = categories.filter((c) => c.type === type);
        if (available.length > 0) {
            setSelectedCategoryId(available[0].id);
        } else {
            setSelectedCategoryId(null);
        }
    }, [type, categories]);

    async function fetchCategories() {
        const { data } = await supabase.from('categories').select('*').order('name');
        if (data) setCategories(data);
    }

    async function fetchTransactions() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('transactions')
                .select('*, categories(*)')
                .order('due_date', { ascending: false });

            if (error) throw error;
            setTransactions(data || []);
        } catch (err) {
            console.error('Erro ao buscar lançamentos:', err);
        } finally {
            setLoading(false);
        }
    }

    // Alternar Status (Pago/Recebido <-> Pendente)
    async function toggleTransactionStatus(item: Transaction) {
        const newStatus = !item.is_completed;
        const newAmountActual = newStatus ? item.amount_expected : null;

        const { error } = await supabase
            .from('transactions')
            .update({
                is_completed: newStatus,
                amount_actual: newAmountActual,
                completed_at: newStatus ? new Date().toISOString().split('T')[0] : null,
            })
            .eq('id', item.id);

        if (!error) fetchTransactions();
    }

    // Criar Novo Lançamento
    async function handleCreateTransaction() {
        if (!title || !amount) {
            Alert.alert('Atenção', 'Preencha o nome e o valor.');
            return;
        }

        const formattedDate = selectedDate.toISOString().split('T')[0];

        const { error } = await supabase.from('transactions').insert([
            {
                title,
                type,
                amount_expected: parseFloat(amount),
                due_date: formattedDate,
                category_id: selectedCategoryId,
                is_completed: false,
            },
        ]);

        if (!error) {
            setModalVisible(false);
            setTitle('');
            setAmount('');
            setSelectedDate(new Date());
            fetchTransactions();
        } else {
            Alert.alert('Erro ao salvar', error.message);
        }
    }

    // Deletar Lançamento
    async function handleDeleteTransaction(id: string) {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (!error) fetchTransactions();
    }

    // Handler para mudança de data
    const handleDateChange = (event: any, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        if (date) {
            setSelectedDate(date);
        }
    };

    const filteredTransactions = transactions.filter((t) => {
        if (filterStatus === 'PENDING') return !t.is_completed;
        if (filterStatus === 'DONE') return t.is_completed;
        return true;
    });

    const currentCategories = categories.filter((c) => c.type === type);
    const selectedCategoryObj = categories.find((c) => c.id === selectedCategoryId);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Lançamentos</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setModalVisible(true)}
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
                        <View style={styles.card}>
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
                                <Text style={styles.itemTitle}>{item.title}</Text>
                                <Text style={styles.itemSub}>
                                    {item.categories?.name || 'Sem categoria'} • {item.due_date}
                                </Text>
                            </View>

                            <Text
                                style={[
                                    styles.itemAmount,
                                    { color: item.type === 'Entrada' ? '#2e7d32' : '#c62828' },
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
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Novo Lançamento</Text>

                        {/* Campo 1: Nome */}
                        <Text style={styles.label}>Nome</Text>
                        <TextInput
                            placeholder="Ex: Faculdade, Salário"
                            style={styles.input}
                            value={title}
                            onChangeText={setTitle}
                        />

                        {/* Campo 2: Valor */}
                        <Text style={styles.label}>Valor (R$)</Text>
                        <TextInput
                            placeholder="0,00"
                            keyboardType="numeric"
                            style={styles.input}
                            value={amount}
                            onChangeText={setAmount}
                        />

                        {/* Campo 3: Tipo (Entrada/Saída) */}
                        <Text style={styles.label}>Tipo</Text>
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
                                    onPress={() => setType(t)}
                                >
                                    <Text style={{ color: type === t ? '#fff' : '#333', fontWeight: 'bold' }}>
                                        {t}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Campo 4: Selector de Categoria */}
                        <Text style={styles.label}>Categoria</Text>
                        <TouchableOpacity
                            style={styles.selectorButton}
                            onPress={() => setCategoryPickerVisible(true)}
                        >
                            <Text style={styles.selectorButtonText}>
                                {selectedCategoryObj ? selectedCategoryObj.name : 'Selecione uma categoria'}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color="#555" />
                        </TouchableOpacity>

                        {/* Campo 5 (Último Campo): DatePicker para Vencimento */}
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
                                    onPress={() => setShowDatePicker(true)}
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
                    </View>
                </View>
            </Modal>

            {/* Sub-Modal / Selector de Categoria */}
            <Modal visible={categoryPickerVisible} animationType="fade" transparent>
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setCategoryPickerVisible(false)}
                >
                    <View style={styles.pickerModalContent}>
                        <Text style={styles.pickerModalTitle}>Selecione a Categoria</Text>
                        {currentCategories.map((cat) => (
                            <TouchableOpacity
                                key={cat.id}
                                style={[
                                    styles.pickerOption,
                                    selectedCategoryId === cat.id && styles.pickerOptionSelected,
                                ]}
                                onPress={() => {
                                    setSelectedCategoryId(cat.id);
                                    setCategoryPickerVisible(false);
                                }}
                            >
                                <Text
                                    style={[
                                        styles.pickerOptionText,
                                        selectedCategoryId === cat.id && styles.pickerOptionTextSelected,
                                    ]}
                                >
                                    {cat.name}
                                </Text>
                                {selectedCategoryId === cat.id && (
                                    <Ionicons name="checkmark" size={18} color="#2b2d42" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 15 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a' },
    addButton: { backgroundColor: '#2b2d42', padding: 10, borderRadius: 10 },
    filterContainer: { flexDirection: 'row', marginBottom: 15 },
    filterTab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#e0e0e0', marginRight: 8 },
    filterTabActive: { backgroundColor: '#2b2d42' },
    filterText: { color: '#555', fontSize: 12, fontWeight: '600' },
    filterTextActive: { color: '#fff' },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
    checkArea: { marginRight: 10 },
    cardInfo: { flex: 1 },
    itemTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
    itemSub: { fontSize: 12, color: '#777', marginTop: 2 },
    itemAmount: { fontSize: 15, fontWeight: 'bold', marginRight: 10 },
    deleteBtn: { padding: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '88%', backgroundColor: '#fff', borderRadius: 16, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    label: { fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 4, marginTop: 8 },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
    typeRow: { flexDirection: 'row', justifyContent: 'space-between' },
    typeBtn: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', marginHorizontal: 2, backgroundColor: '#eee' },
    selectorButton: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    selectorButtonText: { fontSize: 14, color: '#333' },
    webDateInput: {
        width: '100%',
        padding: '10px',
        borderRadius: '8px',
        border: '1px solid #ccc',
        fontSize: '14px',
        boxSizing: 'border-box',
    } as any,
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 },
    cancelBtn: { padding: 10, marginRight: 10 },
    saveBtn: { backgroundColor: '#2b2d42', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
    pickerModalContent: { width: '80%', backgroundColor: '#fff', borderRadius: 12, padding: 16 },
    pickerModalTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#2b2d42' },
    pickerOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
    pickerOptionSelected: { backgroundColor: '#f0f4f8' },
    pickerOptionText: { fontSize: 14, color: '#333' },
    pickerOptionTextSelected: { fontWeight: 'bold', color: '#2b2d42' },
});