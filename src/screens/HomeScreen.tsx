import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from '../config/supabaseClient';
import { MonthlySummary } from '../types/transaction';

export default function HomeScreen() {
    const [summary, setSummary] = useState<MonthlySummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMonthlySummary();
    }, []);

    async function fetchMonthlySummary() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('view_monthly_summary')
                .select('*')
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            setSummary(data);
        } catch (err) {
            console.error('Erro ao buscar resumo:', err);
        } finally {
            setLoading(false);
        }
    }

    // Cálculo do Diário Líquido
    const calculateDailyBudget = (remainingBalance: number) => {
        const today = new Date();
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const daysLeft = lastDayOfMonth - today.getDate() + 1;
        return remainingBalance > 0 ? (remainingBalance / daysLeft).toFixed(2) : '0.00';
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#2b2d42" />
            </View>
        );
    }

    const balance = summary?.remaining_balance ?? 0;

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.headerTitle}>Conta Certa 🎯</Text>

            {/* Card Principais - Saldo Restante */}
            <View style={styles.mainCard}>
                <Text style={styles.cardLabel}>Dinheiro Restante</Text>
                <Text style={styles.balanceValue}>
                    R$ {balance.toFixed(2)}
                </Text>

                <View style={styles.divider} />

                <Text style={styles.dailyLabel}>
                    Diário Líquido Sugerido: <Text style={styles.dailyValue}>R$ {calculateDailyBudget(balance)}/dia</Text>
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
    dailyLabel: { color: '#edf2f4', fontSize: 14 },
    dailyValue: { fontWeight: 'bold', color: '#4ea8de' },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    subCard: { flex: 1, padding: 16, borderRadius: 12, marginHorizontal: 4 },
    subCardLabel: { fontSize: 12, color: '#555', fontWeight: '600' },
    subCardValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
    pendingCard: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12, marginHorizontal: 4, borderWidth: 1, borderColor: '#e0e0e0' },
    pendingLabel: { fontSize: 12, color: '#777' },
    pendingValue: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 4 },
});