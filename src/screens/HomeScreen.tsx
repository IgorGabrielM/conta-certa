import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { fetchHomeSummary, calculateDailyBudget } from '../services/homeService'; // Importando do serviço!

export default function HomeScreen() {
    const [infoModalVisible, setInfoModalVisible] = useState(false);

    // 🎯 React Query chamando diretamente a função do serviço
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['homeSummary'],
        queryFn: fetchHomeSummary
    });

    // Garante o recarregamento ao focar na aba
    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [refetch])
    );

    const summary = data?.summary || null;
    const payDay = data?.payDay || 1;

    if (isLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#2b2d42" />
            </View>
        );
    }

    // Usando a função do serviço, passando os dados do summary e o payDay
    const { dailyAvailable, nextDaysBudget, daysLeft, freeProjectedBalance } = calculateDailyBudget(summary, payDay);
    const actualBalance = summary?.remaining_balance ?? 0;

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.headerTitle}>Conta Certa 🎯</Text>

            {/* Card Principal */}
            <View style={styles.mainCard}>
                <Text style={styles.cardLabel}>Dinheiro na Conta</Text>
                <Text style={styles.balanceValue}>
                    R$ {actualBalance.toFixed(2)}
                </Text>

                {/* Indicação do Saldo Projetado (Livre de Contas) */}
                {(summary?.total_outcome_pending ?? 0) > 0 && (
                    <Text style={styles.projectedLabel}>
                        Livre após contas pendentes: R$ {freeProjectedBalance.toFixed(2)}
                    </Text>
                )}

                <View style={styles.divider} />

                {/* Bloco do Gasto Diário */}
                <View style={styles.dailyHeader}>
                    <Text style={styles.dailyLabel}>
                        Disponível para Hoje ({daysLeft} {daysLeft === 1 ? 'dia' : 'dias'} até o pgto)
                    </Text>
                    <TouchableOpacity
                        onPress={() => setInfoModalVisible(true)}
                        style={styles.infoButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="information-circle-outline" size={20} color="#8d99ae" />
                    </TouchableOpacity>
                </View>

                {/* Disponível para Hoje */}
                <Text style={styles.dailyValue}>
                    R$ {dailyAvailable} / hoje
                </Text>

                {/* Meta para os Próximos Dias */}
                <View style={styles.nextDaysContainer}>
                    <Text style={styles.nextDaysLabel}>Meta para os próximos dias:</Text>
                    <Text style={styles.nextDaysValue}>R$ {nextDaysBudget} / dia</Text>
                </View>
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
                    <Text style={styles.pendingLabel}>Saídas Pendentes (A Pagar)</Text>
                    <Text style={[styles.pendingValue, { color: '#d90429' }]}>
                        R$ {(summary?.total_outcome_pending ?? 0).toFixed(2)}
                    </Text>
                </View>
            </View>

            {/* Modal Informativo */}
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
                            <Text style={styles.modalTitle}>Como funciona o Planejamento?</Text>
                        </View>

                        <Text style={styles.modalText}>
                            • **Contas Pendentes:** Suas contas a pagar são travadas e descontadas do saldo livre.{'\n\n'}
                            • **Meta Estável:** Pagar contas ou quitar boletos antigos altera o saldo da conta, mas não desregula nem infla sua meta diária de gastos futuros.{'\n\n'}
                            • **Controle Diário:** Você só perde limite diário futuro se gastar além da meta estabelecida para o dia de hoje.
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
    balanceValue: { color: '#ffffff', fontSize: 32, fontWeight: 'bold', marginTop: 4 },
    projectedLabel: { color: '#2ec4b6', fontSize: 13, fontWeight: '600', marginTop: 4 },
    divider: { height: 1, backgroundColor: '#3d405b', marginVertical: 12 },
    dailyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dailyLabel: { color: '#edf2f4', fontSize: 13 },
    infoButton: { padding: 2 },
    dailyValue: { fontWeight: 'bold', color: '#4ea8de', fontSize: 22, marginTop: 4 },

    nextDaysContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 0.5,
        borderTopColor: '#3d405b',
    },
    nextDaysLabel: { color: '#8d99ae', fontSize: 12 },
    nextDaysValue: { color: '#2ec4b6', fontSize: 13, fontWeight: 'bold', marginLeft: 6 },

    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    subCard: { flex: 1, padding: 16, borderRadius: 12, marginHorizontal: 4 },
    subCardLabel: { fontSize: 12, color: '#555', fontWeight: '600' },
    subCardValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
    pendingCard: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12, marginHorizontal: 4, borderWidth: 1, borderColor: '#e0e0e0' },
    pendingLabel: { fontSize: 12, color: '#777' },
    pendingValue: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 4 },

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
        marginBottom: 20,
        lineHeight: 20,
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