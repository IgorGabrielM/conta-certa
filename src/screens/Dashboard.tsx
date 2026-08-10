import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { supabase } from '../config/supabaseClient';
import { Transaction } from '../types/transaction';

const { width } = Dimensions.get('window');

const COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#e84393', '#00b894', '#fdcb6e'];
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function DashboardScreen() {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const { data: transactions = [], isLoading } = useQuery({
        queryKey: ['transactions'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id);

            if (error) throw error;
            return data || [];
        }
    });

    // 1. Dados para o Gráfico de Rosca (Categorias)
    const donutData = useMemo(() => {
        const expenses = transactions.filter(t => t.type === 'expense');

        const grouped = expenses.reduce((acc, curr) => {
            const cat = curr.category_name || 'Sem categoria';
            const value = curr.amount_actual ?? curr.amount_expected;
            acc[cat] = (acc[cat] || 0) + value;
            return acc;
        }, {} as Record<string, number>);

        const totalExpenses = Object.values(grouped).reduce((sum, val) => sum + val, 0);

        const formattedData = Object.entries(grouped)
            .sort((a, b) => b[1] - a[1])
            .map(([category, amount], index) => {
                const percentage = `${((amount / totalExpenses) * 100).toFixed(0)}%`;

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
    }, [transactions, selectedCategory]);

    // 2. Filtra as transações e pega a cor da categoria selecionada
    const { selectedTransactions, activeColor } = useMemo(() => {
        if (!selectedCategory) return { selectedTransactions: [], activeColor: '#eee' };

        // Pega a cor exata que foi gerada no donutData para essa categoria
        const foundCategoryData = donutData.data.find(d => d.categoryName === selectedCategory);
        const color = foundCategoryData ? foundCategoryData.color : '#4ecdc4';

        const filtered = transactions.filter(t => {
            const cat = t.category_name || 'Sem categoria';
            return t.type === 'expense' && cat === selectedCategory;
        }).sort((a, b) => {
            const dateA = new Date(a.due_date || a.created_at).getTime();
            const dateB = new Date(b.due_date || b.created_at).getTime();
            return dateB - dateA;
        });

        return { selectedTransactions: filtered, activeColor: color };
    }, [transactions, selectedCategory, donutData]);

    // 3. Dados para o Gráfico de Barras (Gastos por Mês)
    const barData = useMemo(() => {
        const expenses = transactions.filter(t => t.type === 'expense');

        const monthlyGroup = expenses.reduce((acc, curr) => {
            const dateStr = curr.due_date || curr.created_at?.split('T')[0];
            if (!dateStr) return acc;

            const [year, month] = dateStr.split('-');
            const monthIndex = parseInt(month, 10) - 1;
            const key = `${year}-${month}`;

            if (!acc[key]) {
                acc[key] = {
                    value: 0,
                    label: MONTH_NAMES[monthIndex],
                    year: parseInt(year, 10),
                    month: monthIndex
                };
            }
            acc[key].value += (curr.amount_actual ?? curr.amount_expected);
            return acc;
        }, {} as Record<string, { value: number, label: string, year: number, month: number }>);

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

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('T')[0].split('-');
        return `${day}/${month}/${year}`;
    };

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

            {donutData.data.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Nenhuma saída registrada ainda.</Text>
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
                            showTextBackground
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
                        /* Aplicando a cor dinamicamente via style array */
                        <View style={[styles.selectedTransactionsContainer, { borderLeftColor: activeColor }]}>
                            <View style={styles.selectedTransactionsHeader}>
                                <Text style={styles.selectedTransactionsTitle}>
                                    Transações de {selectedCategory}
                                </Text>
                                <Text style={styles.selectedTransactionsCount}>
                                    {selectedTransactions.length} item(s)
                                </Text>
                            </View>

                            {selectedTransactions.map((t, index) => {
                                const amount = t.amount_actual ?? t.amount_expected;
                                const date = t.due_date || t.created_at;

                                return (
                                    <View key={t.id || index} style={styles.transactionItem}>
                                        <View style={styles.transactionLeft}>
                                            <Text style={styles.transactionName} numberOfLines={1}>
                                                {t.description || t.title || 'Sem descrição'}
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

                    <Text style={styles.sectionTitle}>Evolução Mensal</Text>
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
                </>
            )}
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
        marginBottom: 20,
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
        // Removi a cor chumbada daqui, agora ela entra via estilo inline no componente!
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