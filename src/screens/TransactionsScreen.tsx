import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, Platform, ScrollView, LayoutAnimation, UIManager, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../config/supabaseClient';
import {Transaction, TransactionFrequency, TransactionType} from '../types/transaction';
import { getMergedCategories, saveCustomCategoryLocally, CategoryItem } from '../services/categoryService';
import { formatDateBR } from "../utils/formatters";
import {
    createOrUpdateTransaction, deleteTransaction,
    fetchTransactions,
    SaveTransactionParams,
    toggleTransactionStatus
} from '../services/transactionService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}


export default function TransactionsScreen() {
    const queryClient = useQueryClient();

    const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'DONE'>('ALL');
    const [filterType, setFilterType] = useState<'ALL' | 'income' | 'expense'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [modalVisible, setModalVisible] = useState(false);

    // Estados para exclusão com confirmação
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<Transaction | null>(null);

    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<TransactionType>('expense');
    const [frequency, setFrequency] = useState<TransactionFrequency>('extra');
    const [categoryInput, setCategoryInput] = useState('');
    const [availableCategories, setAvailableCategories] = useState<CategoryItem[]>([]);
    const [filteredCategories, setFilteredCategories] = useState<CategoryItem[]>([]);
    const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [hasNoDueDate, setHasNoDueDate] = useState(false);
    const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [endDate, setEndDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59));
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [recurringModalVisible, setRecurringModalVisible] = useState(false);

    useEffect(() => {
        if (modalVisible) loadCategories();
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

    const { data: transactions = [], isLoading, refetch } = useQuery({
        queryKey: ['transactions'],
        queryFn: fetchTransactions // Agora chamamos a função do serviço diretamente
    });

    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch])
    );

    const toggleMutation = useMutation({
        mutationFn: (item: Transaction) => toggleTransactionStatus(item), // Chamada para o serviço
        onMutate: async (item) => {
            // ... O código de onMutate (LayoutAnimation, setQueryData, etc) continua EXATAMENTE igual,
            // pois ele lida com a UI (Optimistic Update) e o estado do React Query.
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            await queryClient.cancelQueries({ queryKey: ['transactions'] });
            const previous = queryClient.getQueryData(['transactions']);

            queryClient.setQueryData(['transactions'], (old: Transaction[] = []) =>
                old.map((t) => t.id === item.id ? {
                    ...t,
                    is_completed: !t.is_completed,
                    amount_actual: !t.is_completed ? t.amount_expected : null
                } : t)
            );
            return { previous };
        },
        onError: (err, item, context) => {
            queryClient.setQueryData(['transactions'], context?.previous);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['homeSummary'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (transaction: Transaction) => deleteTransaction(transaction), // Chamada para o serviço
        onMutate: async (transaction) => {
            // ... O código de onMutate e onSuccess continua EXATAMENTE igual.
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            await queryClient.cancelQueries({ queryKey: ['transactions'] });
            const previous = queryClient.getQueryData(['transactions']);

            queryClient.setQueryData(['transactions'], (old: Transaction[] = []) =>
                old.filter((t) => t.id !== transaction.id)
            );
            return { previous };
        },
        onSuccess: () => {
            setDeleteModalVisible(false);
            setItemToDelete(null);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['homeSummary'] });
        }
    });

    const saveMutation = useMutation({
        // Substituímos a mutationFn inline pela nossa função do serviço
        mutationFn: (payload: SaveTransactionParams) => createOrUpdateTransaction(payload),
        onSuccess: (data) => {
            closeModalAndReset();
            queryClient.setQueryData(['transactions'], (old: Transaction[] = []) => {
                if (editingTransaction) {
                    return old.map(t => t.id === data.id ? data : t);
                } else {
                    return [data, ...old];
                }
            });

            queryClient.invalidateQueries({ queryKey: ['homeSummary'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
        },
        onError: (error: Error) => {
            Alert.alert('Erro ao salvar', error.message);
        }
    });

    // Esta função agora fica extremamente limpa, focada apenas em acionar a mutation
    async function performUpdate(updateFuture: boolean) {
        saveMutation.mutate({
            id: editingTransaction?.id,
            title,
            amount,
            type,
            frequency,
            categoryInput,
            availableCategories,
            hasNoDueDate,
            selectedDate,
            updateFuture,
        });
    }

    // A função principal chamada ao apertar o botão "Salvar" ou "Atualizar" do modal
    async function handleSaveTransaction() {
        if (editingTransaction && frequency === 'recurring') {
            // Em vez do Alert nativo, abrimos o nosso Modal customizado
            setRecurringModalVisible(true);
        } else {
            performUpdate(false);
        }
    }

    function confirmDelete(item: Transaction) {
        setItemToDelete(item);
        setDeleteModalVisible(true);
    }

    function handleConfirmDelete() {
        if (itemToDelete) {
            deleteMutation.mutate(itemToDelete);
        }
    }

    const filteredTransactions = useMemo(() => {
        return transactions.filter((t) => {
            // Filtros existentes
            if (filterStatus === 'PENDING' && t.is_completed) return false;
            if (filterStatus === 'DONE' && !t.is_completed) return false;
            if (filterType !== 'ALL' && t.type !== filterType) return false;
            if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;

            // Novo filtro de período
            if (t.due_date) {
                const transDate = new Date(t.due_date + 'T00:00:00');
                return transDate >= startDate && transDate <= endDate;
            }
            return true; // Se não tiver data, mantemos (ou decida se quer ocultar)
        });
    }, [transactions, filterStatus, filterType, searchQuery, startDate, endDate]);

    // Totais calculados dinamicamente com base nos filtros
    const totals = useMemo(() => {
        return filteredTransactions.reduce(
            (acc, t) => {
                const value = t.amount_actual ?? t.amount_expected;
                if (t.type === 'income') {
                    acc.income += value;
                } else {
                    acc.expense += value;
                }
                return acc;
            },
            { income: 0, expense: 0 }
        );
    }, [filteredTransactions]);

    function openEditModal(item: Transaction) {
        setEditingTransaction(item);
        setTitle(item.title);
        setAmount(item.amount_expected.toString().replace('.', ','));
        setType(item.type);
        setFrequency(item.frequency || 'extra');
        setCategoryInput(item.category_name || '');

        if (item.due_date) {
            setHasNoDueDate(false);
            const [year, month, day] = item.due_date.split('-');
            setSelectedDate(new Date(Number(year), Number(month) - 1, Number(day)));
        } else {
            setHasNoDueDate(true);
            setSelectedDate(new Date());
        }
        setShowCategorySuggestions(false);
        setModalVisible(true);
    }

    function closeModalAndReset() {
        setModalVisible(false);
        setEditingTransaction(null);
        setTitle('');
        setAmount('');
        setCategoryInput('');
        setFrequency('extra');
        setSelectedDate(new Date());
        setHasNoDueDate(false);
        setShowCategorySuggestions(false);
    }

    const handleDateChange = (event: any, date?: Date) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (date) setSelectedDate(date);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Lançamentos</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => {
                        closeModalAndReset();
                        setModalVisible(true);
                    }}
                >
                    <Ionicons name="add" size={24} color="#fff"/>
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar lançamento..."
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>


            <View style={styles.filterRowsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.filterRow}>
                        {(['ALL', 'PENDING', 'DONE'] as const).map((status) => (
                            <TouchableOpacity
                                key={status}
                                style={[
                                    styles.filterTab,
                                    filterStatus === status && styles.filterTabActive,
                                ]}
                                onPress={() => setFilterStatus(status)}
                            >
                                <Text style={[styles.filterText, filterStatus === status && styles.filterTextActive]}>
                                    {status === 'ALL' ? 'Todos' : status === 'PENDING' ? 'Pendentes' : 'Concluídos'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    <View style={styles.filterRow}>
                        <TouchableOpacity
                            style={[styles.filterTab, filterType === 'ALL' && styles.filterTabActive]}
                            onPress={() => setFilterType('ALL')}
                        >
                            <Text style={[styles.filterText, filterType === 'ALL' && styles.filterTextActive]}>Ambos</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.filterTab, filterType === 'income' && {backgroundColor: '#2e7d32'}]}
                            onPress={() => setFilterType('income')}
                        >
                            <Text style={[styles.filterText, filterType === 'income' && styles.filterTextActive]}>Entradas</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.filterTab, filterType === 'expense' && {backgroundColor: '#c62828'}]}
                            onPress={() => setFilterType('expense')}
                        >
                            <Text style={[styles.filterText, filterType === 'expense' && styles.filterTextActive]}>Saídas</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>

            <View style={styles.periodFilterContainer}>
                <TouchableOpacity style={styles.dateSelector} onPress={() => setShowStartPicker(true)}>
                    <Text style={styles.dateText}>{formatDateBR(startDate.toISOString().split('T')[0])}</Text>
                </TouchableOpacity>
                <Text style={{ marginHorizontal: 8 }}>até</Text>
                <TouchableOpacity style={styles.dateSelector} onPress={() => setShowEndPicker(true)}>
                    <Text style={styles.dateText}>{formatDateBR(endDate.toISOString().split('T')[0])}</Text>
                </TouchableOpacity>

                {(showStartPicker || showEndPicker) && (
                    <DateTimePicker
                        value={showStartPicker ? startDate : endDate}
                        mode="date"
                        onChange={(event, date) => {
                            if (showStartPicker) {
                                if (date) setStartDate(date);
                                setShowStartPicker(false);
                            } else {
                                if (date) setEndDate(date);
                                setShowEndPicker(false);
                            }
                        }}
                    />
                )}
            </View>

            {/* Painel de Resumo do Filtro */}
            {
                (filterType === 'income' || filterType === 'expense') && (
                    <View style={styles.summaryContainer}>
                        {(filterType === 'income') && (
                            <View style={styles.summaryBox}>
                                <Text style={styles.summaryLabel}>Total Entradas</Text>
                                <Text style={[styles.summaryValue, { color: '#2e7d32' }]}>
                                    R$ {totals.income.toFixed(2).replace('.', ',')}
                                </Text>
                            </View>
                        )}

                        {(filterType === 'expense') && (
                            <View style={styles.summaryBox}>
                                <Text style={styles.summaryLabel}>Total Saídas</Text>
                                <Text style={[styles.summaryValue, { color: '#c62828' }]}>
                                    R$ {totals.expense.toFixed(2).replace('.', ',')}
                                </Text>
                            </View>
                        )}
                    </View>
                )
            }

            {isLoading ? (
                <ActivityIndicator size="large" color="#2b2d42" style={{marginTop: 20}}/>
            ) : (
                <FlatList
                    data={filteredTransactions}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    renderItem={({item}) => (
                        <View style={[styles.card, item.is_completed && styles.cardCompleted]}>
                            <TouchableOpacity
                                style={styles.checkArea}
                                onPress={() => toggleMutation.mutate(item)}
                            >
                                <Ionicons
                                    name={item.is_completed ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={26}
                                    color={item.is_completed ? '#2e7d32' : '#8d99ae'}
                                />
                            </TouchableOpacity>

                            <View style={styles.cardInfo}>
                                <View style={styles.titleRow}>
                                    <Text
                                        style={[
                                            styles.itemTitle,
                                            item.is_completed && styles.itemTitleCompleted,
                                        ]}
                                    >
                                        {item.title}
                                    </Text>
                                    <View
                                        style={[
                                            styles.frequencyBadge,
                                            item.frequency === 'recurring'
                                                ? styles.badgeRecurring
                                                : styles.badgeExtra,
                                        ]}
                                    >
                                        <Text style={styles.frequencyBadgeText}>
                                            {item.frequency === 'recurring' ? 'Recorrente' : 'Extra'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.itemSub}>
                                    {item.category_name || 'Sem categoria'} • {item.due_date ? formatDateBR(item.due_date) : 'Sem data definida'}
                                </Text>
                            </View>

                            <Text
                                style={[
                                    styles.itemAmount,
                                    {color: item.type === 'income' ? '#2e7d32' : '#c62828'},
                                    item.is_completed && {opacity: 0.5},
                                ]}
                            >
                                {item.type === 'income' ? '+' : '-'} R${' '}
                                {(item.amount_actual ?? item.amount_expected).toFixed(2).replace('.', ',')}
                            </Text>

                            <View style={styles.actionButtonsContainer}>
                                <TouchableOpacity
                                    onPress={() => openEditModal(item)}
                                    style={styles.actionBtnTop}
                                >
                                    <Ionicons name="pencil-outline" size={18} color="#555"/>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => confirmDelete(item)}
                                    style={styles.actionBtnBottom}
                                >
                                    <Ionicons name="trash-outline" size={18} color="#c62828"/>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                />
            )}

            {/* Modal de Confirmação de Exclusão */}
            <Modal
                visible={deleteModalVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setDeleteModalVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setDeleteModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableOpacity
                            activeOpacity={1}
                            style={styles.confirmModalContent}
                            onPress={(e) => e.stopPropagation()}
                        >
                            <View style={styles.confirmIconContainer}>
                                <Ionicons name="trash-outline" size={32} color="#c62828" />
                            </View>
                            <Text style={styles.confirmTitle}>Excluir Lançamento</Text>
                            <Text style={styles.confirmMessage}>
                                Tem certeza que deseja apagar{' '}
                                <Text style={{ fontWeight: 'bold' }}>
                                    "{itemToDelete?.title}"
                                </Text>
                                ? Esta ação não pode ser desfeita.
                            </Text>

                            <View style={styles.confirmActions}>
                                <TouchableOpacity
                                    style={styles.cancelBtn}
                                    onPress={() => {
                                        setDeleteModalVisible(false);
                                        setItemToDelete(null);
                                    }}
                                >
                                    <Text style={{ color: '#555' }}>Cancelar</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.deleteConfirmBtn}
                                    onPress={handleConfirmDelete}
                                    disabled={deleteMutation.isPending}
                                >
                                    {deleteMutation.isPending ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Excluir</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Modal de Criação / Edição */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <TouchableWithoutFeedback onPress={() => {
                    setShowCategorySuggestions(false);
                    Keyboard.dismiss();
                }}>
                    <View style={styles.modalOverlay}>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={{ width: '100%', alignItems: 'center' }}
                        >
                            <TouchableOpacity
                                activeOpacity={1}
                                style={styles.modalContent}
                                onPress={(e) => e.stopPropagation()}
                            >
                                <ScrollView
                                    showsVerticalScrollIndicator={false}
                                    keyboardShouldPersistTaps="handled"
                                >
                                    <Text style={styles.modalTitle}>
                                        {editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}
                                    </Text>

                                    <Text style={styles.label}>Tipo de Lançamento</Text>
                                    <View style={styles.typeRow}>
                                        {(['expense', 'income'] as const).map((t) => (
                                            <TouchableOpacity
                                                key={t}
                                                style={[
                                                    styles.typeBtn,
                                                    type === t && {
                                                        backgroundColor: t === 'income' ? '#2e7d32' : '#c62828',
                                                    },
                                                ]}
                                                onPress={() => {
                                                    setType(t);
                                                    setShowCategorySuggestions(false);
                                                }}
                                            >
                                                <Text style={{ color: type === t ? '#fff' : '#333', fontWeight: 'bold' }}>
                                                    {t === 'expense' ? 'Saída' : 'Entrada'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={styles.label}>Frequência / Natureza</Text>
                                    <View style={styles.typeRow}>
                                        <TouchableOpacity
                                            style={[
                                                styles.typeBtn,
                                                frequency === 'extra' && { backgroundColor: '#2b2d42' },
                                            ]}
                                            onPress={() => setFrequency('extra')}
                                        >
                                            <Text style={{ color: frequency === 'extra' ? '#fff' : '#333', fontWeight: 'bold', fontSize: 12 }}>
                                                Extra / Variável
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.typeBtn,
                                                frequency === 'recurring' && { backgroundColor: '#2b2d42' },
                                            ]}
                                            onPress={() => setFrequency('recurring')}
                                        >
                                            <Text style={{ color: frequency === 'recurring' ? '#fff' : '#333', fontWeight: 'bold', fontSize: 12 }}>
                                                Recorrente / Fixo
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.label}>Nome</Text>
                                    <TextInput
                                        placeholder="Ex: Aluguel, Mercado, Salário"
                                        placeholderTextColor="#999"
                                        style={styles.input}
                                        value={title}
                                        onChangeText={setTitle}
                                        onFocus={() => setShowCategorySuggestions(false)}
                                    />

                                    <Text style={styles.label}>Valor (R$)</Text>
                                    <TextInput
                                        placeholder="Ex: 150,00"
                                        placeholderTextColor="#999"
                                        keyboardType="decimal-pad"
                                        style={styles.input}
                                        value={amount}
                                        onChangeText={setAmount}
                                        onFocus={() => setShowCategorySuggestions(false)}
                                    />

                                    <Text style={styles.label}>Categoria (Digite ou escolha)</Text>
                                    <View style={styles.autocompleteWrapper}>
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
                                            onBlur={() => {
                                                setTimeout(() => {
                                                    setShowCategorySuggestions(false);
                                                }, 150);
                                            }}
                                        />

                                        {showCategorySuggestions && (
                                            <View style={styles.suggestionsContainer}>
                                                {filteredCategories.length > 0 ? (
                                                    <ScrollView
                                                        style={{ maxHeight: 120 }}
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

                                    <TouchableOpacity
                                        style={styles.checkboxContainer}
                                        onPress={() => setHasNoDueDate(!hasNoDueDate)}
                                    >
                                        <Ionicons
                                            name={hasNoDueDate ? 'checkbox' : 'square-outline'}
                                            size={24}
                                            color={hasNoDueDate ? '#2b2d42' : '#999'}
                                        />
                                        <Text style={styles.checkboxLabel}>
                                            Não possui data de {type === 'income' ? 'recebimento' : 'vencimento'}
                                        </Text>
                                    </TouchableOpacity>

                                    {!hasNoDueDate && (
                                        <>
                                            <Text style={styles.label}>
                                                {type === 'income' ? 'Data de Recebimento' : 'Data de Vencimento'}
                                            </Text>

                                            {Platform.OS === 'web' ? (
                                                <input
                                                    type="date"
                                                    value={selectedDate.toISOString().split('T')[0]}
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            setSelectedDate(new Date(e.target.value + 'T00:00:00'));
                                                        }
                                                    }}
                                                    style={styles.webDateInput as any}
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
                                        </>
                                    )}

                                    <View style={styles.modalActions}>
                                        <TouchableOpacity
                                            style={styles.cancelBtn}
                                            onPress={closeModalAndReset}
                                        >
                                            <Text style={{ color: '#555' }}>Cancelar</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTransaction}>
                                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                                                {editingTransaction ? 'Atualizar' : 'Salvar'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            </TouchableOpacity>
                        </KeyboardAvoidingView>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
            {/* Modal de Escolha para Transação Recorrente */}
            <Modal
                visible={recurringModalVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setRecurringModalVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setRecurringModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableOpacity
                            activeOpacity={1}
                            style={styles.confirmModalContent}
                            onPress={(e) => e.stopPropagation()}
                        >
                            <View style={[styles.confirmIconContainer, { backgroundColor: '#e0f2fe' }]}>
                                <Ionicons name="repeat-outline" size={32} color="#0284c7" />
                            </View>
                            <Text style={styles.confirmTitle}>Transação Recorrente</Text>
                            <Text style={styles.confirmMessage}>
                                Deseja aplicar a alteração apenas a esta transação ou a esta e todas as futuras?
                            </Text>

                            <View style={{ width: '100%', gap: 10 }}>
                                <TouchableOpacity
                                    style={[styles.saveBtn, { backgroundColor: '#2b2d42', alignItems: 'center' }]}
                                    onPress={() => {
                                        setRecurringModalVisible(false);
                                        performUpdate(false); // Apenas esta
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Apenas Esta</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.saveBtn, { backgroundColor: '#0284c7', alignItems: 'center' }]}
                                    onPress={() => {
                                        setRecurringModalVisible(false);
                                        performUpdate(true); // Esta e futuras
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Esta e Todas Futuras</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.cancelBtn, { alignItems: 'center', marginTop: 4 }]}
                                    onPress={() => setRecurringModalVisible(false)}
                                >
                                    <Text style={{ color: '#555', fontWeight: '600' }}>Cancelar</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1, backgroundColor: '#f8f9fa', padding: 20},
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 15,
    },
    title: {fontSize: 24, fontWeight: 'bold', color: '#1a1a1a'},
    addButton: {backgroundColor: '#2b2d42', padding: 10, borderRadius: 10},

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#eee',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        fontSize: Platform.OS === 'web' ? 16 : 14,
        color: '#333',
    },

    filterRowsContainer: {
        marginBottom: 12,
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterTab: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#e0e0e0',
        marginRight: 8,
    },
    filterTabActive: {backgroundColor: '#2b2d42'},
    filterText: {color: '#555', fontSize: 12, fontWeight: '600'},
    filterTextActive: {color: '#fff'},

    // Estilos do Painel de Resumo
    summaryContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#eee',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    summaryBox: {
        alignItems: 'center',
        flex: 1,
    },
    summaryLabel: {
        fontSize: 11,
        color: '#777',
        fontWeight: '600',
        marginBottom: 2,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    summaryDivider: {
        width: 1,
        height: '80%',
        backgroundColor: '#eee',
    },

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
    checkArea: {marginRight: 10},
    cardInfo: {flex: 1},
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    itemTitle: {fontSize: 15, fontWeight: 'bold', color: '#333'},
    itemTitleCompleted: {
        textDecorationLine: 'line-through',
        color: '#8d99ae',
    },
    frequencyBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badgeExtra: {
        backgroundColor: '#e2e3e5',
    },
    badgeRecurring: {
        backgroundColor: '#e0f2fe',
    },
    frequencyBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#495057',
    },
    itemSub: {fontSize: 12, color: '#777', marginTop: 2},
    itemAmount: {fontSize: 15, fontWeight: 'bold', marginRight: 10},

    actionButtonsContainer: {
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    actionBtnTop: {
        padding: 4,
        marginBottom: 6,
    },
    actionBtnBottom: {
        padding: 4,
    },

    modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center'},
    modalContent: {width: '88%', backgroundColor: '#fff', borderRadius: 16, padding: 20, overflow: 'visible'},

    confirmModalContent: {
        width: '82%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
    },
    confirmIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#fde8e8',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    confirmTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    confirmMessage: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    confirmActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        width: '100%',
        alignItems: 'center',
    },
    deleteConfirmBtn: {
        backgroundColor: '#c62828',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 80,
        alignItems: 'center',
    },

    modalTitle: {fontSize: 18, fontWeight: 'bold', marginBottom: 15},
    label: {fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 4, marginTop: 8},
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 10,
        fontSize: Platform.OS === 'web' ? 16 : 14,
        color: '#333',
    },
    typeRow: {flexDirection: 'row', justifyContent: 'space-between'},
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
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.2,
        shadowRadius: 5,
    },
    suggestionItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        flexDirection: 'row',
        alignItems: 'center',
    },
    suggestionText: {fontSize: 14, color: '#333'},
    customBadge: {fontSize: 10, color: '#8d99ae', fontStyle: 'italic'},
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
        borderRadius: '8px',
        boxSizing: 'border-box',
        padding: 10
    },

    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 15,
        marginBottom: 10,
        gap: 8,
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#333',
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
    periodFilterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    dateSelector: {
        backgroundColor: '#fff',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eee',
    },
    dateText: {
        fontSize: 13,
        color: '#333',
    },
});