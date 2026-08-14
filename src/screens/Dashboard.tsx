import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, Alert, Platform, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../config/supabaseClient';
import { Transaction } from '../types/transaction';

const { width } = Dimensions.get('window');

const COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#e84393', '#00b894', '#fdcb6e'];
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// --- Interfaces de Tipagem ---
interface DonutChartData {
    value: number;
    color: string;
    text: string;
    categoryName: string;
    focused: boolean;
    onPress: () => void;
}

interface DonutDataResult {
    data: DonutChartData[];
    total: number;
}

interface SelectedTransactionsResult {
    selectedTransactions: Transaction[];
    activeColor: string;
}

interface BarChartData {
    value: number;
    label: string;
    frontColor: string;
    topLabelComponent: () => React.JSX.Element;
    onPress: () => void;
}

interface MonthlyGroupItem {
    value: number;
    label: string;
    year: number;
    month: number;
}
// -----------------------------

export default function DashboardScreen() {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // --- Estados para o filtro de data (Padrão: Mês Atual) ---
    const [startDate, setStartDate] = useState<Date>(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [endDate, setEndDate] = useState<Date>(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    });
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    // ---------------------------------------------------------

    const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
        queryKey: ['transactions'],
        queryFn: async (): Promise<Transaction[]> => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id);

            if (error) throw error;
            return (data as Transaction[]) || [];
        }
    });

    // Filtra as transações pelo período selecionado no Dashboard
    const filteredTransactions = useMemo(() => {
        if (!startDate || !endDate) return transactions;

        return transactions.filter(t => {
            if (t.due_date) {
                const transDate = new Date(t.due_date + 'T00:00:00');
                return transDate >= startDate && transDate <= endDate;
            }
            return true;
        });
    }, [transactions, startDate, endDate]);

    // 1. Dados para o Gráfico de Rosca (Categorias) -> Usa transações filtradas
    const donutData = useMemo<DonutDataResult>(() => {
        const expenses = filteredTransactions.filter(t => t.type === 'expense');

        const grouped = expenses.reduce((acc, curr) => {
            const cat = curr.category_name || 'Sem categoria';
            const value = (curr.amount_actual ?? curr.amount_expected) || 0;
            acc[cat] = (acc[cat] || 0) + value;
            return acc;
        }, {} as Record<string, number>);

        const totalExpenses = Object.values(grouped).reduce((sum, val) => sum + val, 0);

        const formattedData: DonutChartData[] = Object.entries(grouped)
            .sort((a, b) => b[1] - a[1])
            .map(([category, amount], index) => {
                const percentage = totalExpenses > 0 ? `${((amount / totalExpenses) * 100).toFixed(0)}%` : '0%';

                return {
                    value: amount,
                    color: COLORS[index % COLORS.length],
                    text: percentage,
                    categoryName: category,
                    focused: selectedCategory === category,
                    onPress: () => {
                        setSelectedCategory(prev => prev === category ? null : category);
                    }
                };
            });

        return { data: formattedData, total: totalExpenses };
    }, [filteredTransactions, selectedCategory]);

    // 2. Filtra as transações e pega a cor da categoria selecionada -> Usa transações filtradas
    const { selectedTransactions, activeColor } = useMemo<SelectedTransactionsResult>(() => {
        if (!selectedCategory) return { selectedTransactions: [], activeColor: '#eee' };

        const foundCategoryData = donutData.data.find(d => d.categoryName === selectedCategory);
        const color = foundCategoryData ? foundCategoryData.color : '#4ecdc4';

        const filtered = filteredTransactions.filter(t => {
            const cat = t.category_name || 'Sem categoria';
            return t.type === 'expense' && cat === selectedCategory;
        }).sort((a, b) => {
            const dateA = new Date(a.due_date || '').getTime();
            const dateB = new Date(b.due_date || '').getTime();
            return dateB - dateA;
        });

        return { selectedTransactions: filtered, activeColor: color };
    }, [filteredTransactions, selectedCategory, donutData]);

    // 3. Dados para o Gráfico de Barras (Gastos por Mês)
    // MANTEMOS A LISTA "transactions" AQUI PARA PRESERVAR OS 6 MESES HISTÓRICOS
    const barData = useMemo<BarChartData[]>(() => {
        const expenses = transactions.filter(t => t.type === 'expense');

        const monthlyGroup = expenses.reduce((acc, curr) => {
            const dateStr = curr.due_date;
            if (!dateStr) return acc;

            const [year, month] = dateStr.split('-');
            if (!year || !month) return acc;

            const monthIndex = parseInt(month, 10) - 1;
            const key = `${year}-${month}`;
            const value = (curr.amount_actual ?? curr.amount_expected) || 0;

            if (!acc[key]) {
                acc[key] = {
                    value: 0,
                    label: MONTH_NAMES[monthIndex],
                    year: parseInt(year, 10),
                    month: monthIndex
                };
            }
            acc[key].value += value;
            return acc;
        }, {} as Record<string, MonthlyGroupItem>);

        const sortedMonths = Object.values(monthlyGroup)
            .sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year)
            .slice(-6);

        return sortedMonths.map(item => ({
            value: item.value,
            label: item.label,
            frontColor: '#2b2d42',
            topLabelComponent: () => (
                <Text style={{ fontSize: 10, color: '#888', marginBottom: 4, fontWeight: 'bold' }}>
                    {item.value >= 1000 ? `${(item.value / 1000).toFixed(1)}k` : Math.round(item.value)}
                </Text>
            ),
            onPress: () => {
                Alert.alert(
                    `Resumo de ${item.label}/${item.year}`,
                    `Total Gasto: R$ ${item.value.toFixed(2).replace('.', ',')}`
                );
            }
        }));
    }, [transactions]);

    // --- Helpers locais para tratamento seguro de datas ---
    const getLocalWebDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const getLocalFormattedDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${d}/${m}/${y}`;
    };

    const formatDate = (dateString?: string): string => {
        if (!dateString) return '';
        const parts = dateString.split('T')[0].split('-');
        if (parts.length !== 3) return dateString;
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    };
    // --------------------------------------------------------

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2b2d42" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
                <Text style={styles.title}>Dashboard</Text>
                <Text style={styles.subtitle}>Visão geral dos seus gastos</Text>
            </View>

            {/* --- COMPONENTE DO FILTRO DE DATA --- */}
            <View style={styles.periodFilterContainer}>
                {Platform.OS === 'web' ? (
                    <>
                        <input
                            type="date"
                            value={getLocalWebDate(startDate)}
                            onChange={(e) => {
                                if (e.target.value) {
                                    setStartDate(new Date(e.target.value + 'T00:00:00'));
                                }
                            }}
                            style={styles.webPeriodDateInput as any}
                        />
                        <Text style={{ marginHorizontal: 8 }}>até</Text>
                        <input
                            type="date"
                            value={getLocalWebDate(endDate)}
                            onChange={(e) => {
                                if (e.target.value) {
                                    setEndDate(new Date(e.target.value + 'T23:59:59'));
                                }
                            }}
                            style={styles.webPeriodDateInput as any}
                        />
                    </>
                ) : (
                    <>
                        <TouchableOpacity
                            style={styles.dateSelector}
                            onPress={() => setShowStartPicker(true)}
                        >
                            <Text style={styles.dateText}>
                                {getLocalFormattedDate(startDate)}
                            </Text>
                        </TouchableOpacity>

                        <Text style={{ marginHorizontal: 8 }}>até</Text>

                        <TouchableOpacity
                            style={styles.dateSelector}
                            onPress={() => setShowEndPicker(true)}
                        >
                            <Text style={styles.dateText}>
                                {getLocalFormattedDate(endDate)}
                            </Text>
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
                                        if (date) {
                                            setEndDate(
                                                new Date(
                                                    date.getFullYear(),
                                                    date.getMonth(),
                                                    date.getDate(),
                                                    23,
                                                    59,
                                                    59
                                                )
                                            );
                                        }
                                        setShowEndPicker(false);
                                    }
                                }}
                            />
                        )}
                    </>
                )}
            </View>
            {/* ---------------------------------- */}

            {donutData.data.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Nenhuma saída registrada ainda no período selecionado.</Text>
                </View>
            ) : (
                <>
                    <Text style={styles.sectionTitle}>Por Categoria</Text>
                    <Text style={styles.hintText}>Toque em uma fatia para ver os detalhes</Text>

                    <View style={styles.chartCard}>
                        <PieChart
                            data={donutData.data}
                            donut
                            showText
                            textColor="white"
                            radius={width * 0.3}
                            innerRadius={width * 0.18}
                            textSize={12}
                            textBackgroundRadius={14}
                            focusOnPress
                            centerLabelComponent={() => (
                                <View style={styles.centerLabel}>
                                    <Text style={styles.centerLabelTitle}>Total</Text>
                                    <Text style={styles.centerLabelValue}>
                                        R$ {donutData.total.toFixed(2).replace('.', ',')}
                                    </Text>
                                </View>
                            )}
                        />
                    </View>

                    {selectedCategory && (
                        <View style={[styles.selectedTransactionsContainer, { borderLeftColor: activeColor }]}>
                            <View style={styles.selectedTransactionsHeader}>
                                <Text style={styles.selectedTransactionsTitle}>
                                    {selectedCategory}
                                </Text>
                                <Text style={styles.selectedTransactionsCount}>
                                    {selectedTransactions.length} item(s)
                                </Text>
                            </View>

                            {selectedTransactions.map((t, index) => {
                                const amount = (t.amount_actual ?? t.amount_expected) || 0;
                                const date = t.due_date;

                                return (
                                    <View key={t.id || index} style={styles.transactionItem}>
                                        <View style={styles.transactionLeft}>
                                            <Text style={styles.transactionName} numberOfLines={1}>
                                                {t.title || 'Sem descrição'}
                                            </Text>
                                            <Text style={styles.transactionDate}>
                                                {formatDate(date)}
                                            </Text>
                                        </View>
                                        <View style={styles.transactionRight}>
                                            <Text style={styles.transactionAmount}>
                                                R$ {amount.toFixed(2).replace('.', ',')}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}

                            <View style={styles.transactionResume}>
                                <View style={styles.transactionLeft}>
                                    <Text style={styles.transactionName}>
                                        Gasto total:
                                    </Text>
                                </View>
                                <View style={styles.transactionRight}>
                                    <Text style={styles.transactionAmount}>
                                        R$ {selectedTransactions
                                        .reduce((acc, t) => acc + ((t.amount_actual ?? t.amount_expected) || 0), 0)
                                        .toFixed(2)
                                        .replace('.', ',')}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    <Text style={styles.sectionTitle}>Detalhamento Geral</Text>
                    <View style={styles.legendContainer}>
                        {donutData.data.map((item, index) => (
                            <View key={index} style={styles.legendItem}>
                                <View style={styles.legendLeft}>
                                    <View style={[styles.colorIndicator, { backgroundColor: item.color }]} />
                                    <Text style={styles.legendCategory}>{item.categoryName}</Text>
                                </View>

                                <View style={styles.legendRight}>
                                    <Text style={styles.legendAmount}>
                                        R$ {item.value.toFixed(2).replace('.', ',')}
                                    </Text>
                                    <Text style={styles.legendPercent}>
                                        {item.text}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </>
            )}

            {/* Renderizado independente do filtro para que os últimos 6 meses sempre apareçam */}
            <Text style={[styles.sectionTitle, { marginTop: donutData.data.length === 0 ? 20 : 0 }]}>Evolução Mensal</Text>
            <View style={styles.chartCard}>
                {barData.length > 0 ? (
                    <BarChart
                        data={barData}
                        barWidth={28}
                        spacing={24}
                        roundedTop
                        hideRules
                        xAxisThickness={1}
                        xAxisColor="#eee"
                        yAxisThickness={0}
                        yAxisTextStyle={{ color: '#aaa', fontSize: 11 }}
                        noOfSections={4}
                        isAnimated
                        animationDuration={800}
                    />
                ) : (
                    <Text style={styles.emptyText}>Dados insuficientes para histórico.</Text>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        padding: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
    header: {
        marginTop: 20,
        marginBottom: 10, // Menos espaçamento para encaixar o filtro de data elegantemente
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    subtitle: {
        fontSize: 14,
        color: '#777',
        marginTop: 4,
    },
    // --- ESTILOS DO FILTRO DE DATA ---
    periodFilterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    webPeriodDateInput: {
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        padding: 8,
        fontSize: 13,
        color: '#333',
        backgroundColor: '#fff',
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
    // ---------------------------------
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
        marginLeft: 4,
    },
    hintText: {
        fontSize: 12,
        color: '#888',
        marginLeft: 4,
        marginBottom: 10,
    },
    emptyContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 40,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#eee',
    },
    emptyText: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
    },
    chartCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#eee',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        width: '100%',
        overflow: 'hidden',
    },
    centerLabel: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerLabelTitle: {
        fontSize: 12,
        color: '#888',
    },
    centerLabelValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#c62828',
        marginTop: 4,
    },
    selectedTransactionsContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#eee',
        borderLeftWidth: 4,
    },
    selectedTransactionsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f3f5',
        paddingBottom: 10,
    },
    selectedTransactionsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2b2d42',
    },
    selectedTransactionsCount: {
        fontSize: 12,
        color: '#888',
        backgroundColor: '#f1f3f5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    transactionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    transactionResume: {
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#aaaaaa',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    transactionLeft: {
        flex: 1,
        marginRight: 10,
    },
    transactionName: {
        fontSize: 15,
        color: '#333',
        fontWeight: '500',
        marginBottom: 4,
    },
    transactionDate: {
        fontSize: 12,
        color: '#888',
    },
    transactionRight: {
        alignItems: 'flex-end',
    },
    transactionAmount: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#c62828',
    },
    legendContainer: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 40,
        borderWidth: 1,
        borderColor: '#eee',
    },
    legendItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f3f5',
    },
    legendLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    colorIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    legendCategory: {
        fontSize: 15,
        color: '#444',
        fontWeight: '500',
    },
    legendRight: {
        alignItems: 'flex-end',
    },
    legendAmount: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#333',
    },
    legendPercent: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
});