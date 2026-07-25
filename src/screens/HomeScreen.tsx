import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabaseClient';
import { MonthlySummary } from '../types/transaction';

const PAYDAY_STORAGE_KEY = '@user_payday';

export default function HomeScreen() {
    const [summary, setSummary] = useState<MonthlySummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [payDay, setPayDay] = useState<number>(1);
    const [infoModalVisible, setInfoModalVisible] = useState(false);

    // 🔄 Recarrega o resumo e o dia de pagamento sempre que a tela ganha foco
    useFocusEffect(
        useCallback(() => {
            loadPayDayAndSummary();
        }, [])
    );

    async function loadPayDayAndSummary() {
        try {
            setLoading(true);

            // 1. Busca o dia de pagamento salvo localmente
            const savedPayDay = await AsyncStorage.getItem(PAYDAY_STORAGE_KEY);
            const currentPayDay = savedPayDay ? parseInt(savedPayDay, 10) : 1;
            setPayDay(currentPayDay);

            // 2. Busca o resumo das transações do Supabase
            const { data, error } = await supabase
                .from('view_monthly_summary')
                .select('*')
                .maybeSingle();

            if (error) throw error;
            setSummary(data);
        } catch (err) {
            console.error('Erro ao buscar dados:', err);
        } finally {
            setLoading(false);
        }
    }

    // 🧮 Calcula quantos dias faltam para o próximo pagamento
    const getDaysUntilNextPayday = (payDayOfMonth: number) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        const currentDay = today.getDate();

        let targetYear = currentYear;
        let targetMonth = currentMonth;

        if (currentDay >= payDayOfMonth) {
            targetMonth = currentMonth + 1;
            if (targetMonth > 11) {
                targetMonth = 0;
                targetYear = currentYear + 1;
            }
        }

        const maxDaysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        const actualPayDay = Math.min(payDayOfMonth, maxDaysInTargetMonth);

        const nextPaydayDate = new Date(targetYear, targetMonth, actualPayDay);

        const diffInTime = nextPaydayDate.getTime() - today.getTime();
        const daysLeft = Math.max(1, Math.ceil(diffInTime / (1000 * 3600 * 24)));

        return daysLeft;
    };

    // 🧮 Cálculo do Gasto Diário baseado nos dias restantes até o pagamento
    const calculateDailyBudget = (remainingBalance: number) => {
        if (remainingBalance <= 0) return { daily: '0.00', daysLeft: 0 };

        const daysLeft = getDaysUntilNextPayday(payDay);
        const daily = (remainingBalance / daysLeft).toFixed(2);

        return { daily, daysLeft };
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#2b2d42" />
            </View>
        );
    }

    const balance = summary?.remaining_balance ?? 0;
    const { daily, daysLeft } = calculateDailyBudget(balance);

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.headerTitle}>Conta Certa 🎯</Text>

            {/* Card Principal - Saldo Restante */}
            <View style={styles.mainCard}>
                <Text style={styles.cardLabel}>Dinheiro Restante</Text>
                <Text style={styles.balanceValue}>
                    R$ {balance.toFixed(2)}
                </Text>

                <View style={styles.divider} />

                {/* Título Gasto Diário com botão de informação */}
                <View style={styles.dailyHeader}>
                    <Text style={styles.dailyLabel}>
                        Gasto Diário ({daysLeft} {daysLeft === 1 ? 'dia' : 'dias'} até o pgto)
                    </Text>
                    <TouchableOpacity
                        onPress={() => setInfoModalVisible(true)}
                        style={styles.infoButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="information-circle-outline" size={20} color="#8d99ae" />
                    </TouchableOpacity>
                </View>

                <Text style={styles.dailyValue}>
                    R$ {daily} / dia
                </Text>
            </View>

            {/* Cards Indicadores */}
            <View style={styles.row}>
                <View style={[styles.subCard, { backgroundColor: '#e8f5e9' }]}>
                    <Text style={styles.subCardLabel}>Entradas Reais</Text>
                    <Text style={[styles.subCardValue, { color: '#2e7d32' }]}>
                        R$ {(summary?.total_income_actual ?? 0).toFixed(2)}
                    </Text>
                </View>

                <View style={[styles.subCard, { backgroundColor: '#ffebee' }]}>
                    <Text style={styles.subCardLabel}>Saídas Reais</Text>
                    <Text style={[styles.subCardValue, { color: '#c62828' }]}>
                        R$ {(summary?.total_outcome_actual ?? 0).toFixed(2)}
                    </Text>
                </View>
            </View>

            {/* Pendências */}
            <View style={styles.row}>
                <View style={styles.pendingCard}>
                    <Text style={styles.pendingLabel}>Entradas Pendentes</Text>
                    <Text style={styles.pendingValue}>
                        R$ {(summary?.total_income_pending ?? 0).toFixed(2)}
                    </Text>
                </View>

                <View style={styles.pendingCard}>
                    <Text style={styles.pendingLabel}>Saídas Pendentes</Text>
                    <Text style={styles.pendingValue}>
                        R$ {(summary?.total_outcome_pending ?? 0).toFixed(2)}
                    </Text>
                </View>
            </View>

            {/* Modal Informativo sobre o Gasto Diário */}
            <Modal
                visible={infoModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setInfoModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Ionicons name="calculator-outline" size={28} color="#2b2d42" />
                            <Text style={styles.modalTitle}>O que é o Gasto Diário?</Text>
                        </View>

                        <Text style={styles.modalText}>
                            Este valor indica **quanto você pode gastar por dia** sem estourar o seu orçamento até o próximo dia de recebimento.
                        </Text>

                        <Text style={styles.modalSubText}>
                            • Ele pega seu **Dinheiro Restante** e divide pela quantidade de **dias que faltam para o seu pagamento** (configurado na aba Ajustes).{'\n\n'}
                            • Se você gastar menos do que essa meta hoje, seu limite diário para os próximos dias vai aumentar automaticamente!
                        </Text>

                        <TouchableOpacity
                            style={styles.modalCloseBtn}
                            onPress={() => setInfoModalVisible(false)}
                        >
                            <Text style={styles.modalCloseText}>Entendi</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 24, fontWeight: 'bold', marginVertical: 20, color: '#1a1a1a' },
    mainCard: {
        backgroundColor: '#2b2d42',
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
        elevation: 3,
    },
    cardLabel: { color: '#8d99ae', fontSize: 14, fontWeight: '600' },
    balanceValue: { color: '#ffffff', fontSize: 32, fontWeight: 'bold', marginVertical: 8 },
    divider: { height: 1, backgroundColor: '#3d405b', marginVertical: 12 },
    dailyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dailyLabel: { color: '#edf2f4', fontSize: 13 },
    infoButton: { padding: 2 },
    dailyValue: { fontWeight: 'bold', color: '#4ea8de', fontSize: 20, marginTop: 4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    subCard: { flex: 1, padding: 16, borderRadius: 12, marginHorizontal: 4 },
    subCardLabel: { fontSize: 12, color: '#555', fontWeight: '600' },
    subCardValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
    pendingCard: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12, marginHorizontal: 4, borderWidth: 1, borderColor: '#e0e0e0' },
    pendingLabel: { fontSize: 12, color: '#777' },
    pendingValue: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 4 },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginLeft: 10,
    },
    modalText: {
        fontSize: 14,
        color: '#333',
        marginBottom: 12,
        lineHeight: 20,
    },
    modalSubText: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
        marginBottom: 20,
    },
    modalCloseBtn: {
        backgroundColor: '#2b2d42',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalCloseText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },
});