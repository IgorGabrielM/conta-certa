import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useFocusEffect } from '@react-navigation/native'; // 👈 Importação do useFocusEffect
import { supabase } from '../config/supabaseClient';
import { Transaction } from '../types/transaction';

// Configuração para Português
LocaleConfig.locales['pt-br'] = {
    monthNames: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
    monthNamesShort: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
    dayNames: ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'],
    dayNamesShort: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],
    today: 'Hoje'
};
LocaleConfig.defaultLocale = 'pt-br';

export default function CalendarScreen() {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [markedDates, setMarkedDates] = useState<any>({});

    // 🔄 Recarrega as transações do calendário sempre que a tela ganha foco
    useFocusEffect(
        useCallback(() => {
            fetchMonthTransactions();
        }, [])
    );

    async function fetchMonthTransactions() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id);

            if (error) throw error;

            if (data) {
                setTransactions(data);

                // Mapeia datas que possuem pendências ou contas
                const marks: any = {};
                data.forEach((item) => {
                    marks[item.due_date] = {
                        marked: true,
                        dotColor: item.type === 'Entrada' ? '#2e7d32' : '#c62828',
                    };
                });
                setMarkedDates(marks);
            }
        } catch (err) {
            console.error('Erro ao buscar transações do calendário:', err);
        }
    }

    const dayTransactions = transactions.filter((t) => t.due_date === selectedDate);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Calendário Financeiro 📅</Text>

            <Calendar
                onDayPress={(day: any) => setSelectedDate(day.dateString)}
                markedDates={{
                    ...markedDates,
                    [selectedDate]: {
                        ...markedDates[selectedDate],
                        selected: true,
                        selectedColor: '#2b2d42',
                    },
                }}
                theme={{
                    todayTextColor: '#4ea8de',
                    arrowColor: '#2b2d42',
                }}
            />

            <View style={styles.listSection}>
                <Text style={styles.subTitle}>Contas em {selectedDate}:</Text>
                <FlatList
                    data={dayTransactions}
                    keyExtractor={(item) => item.id}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>Nenhum lançamento nesta data.</Text>
                    }
                    renderItem={({ item }) => (
                        <View style={styles.itemCard}>
                            <Text style={styles.itemTitle}>{item.title}</Text>
                            <Text
                                style={[
                                    styles.itemAmount,
                                    { color: item.type === 'Entrada' ? '#2e7d32' : '#c62828' },
                                ]}
                            >
                                {item.type === 'Entrada' ? '+' : '-'} R${' '}
                                {(item.amount_actual ?? item.amount_expected).toFixed(2)}
                            </Text>
                        </View>
                    )}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginTop: 20, marginBottom: 15, color: '#1a1a1a' },
    subTitle: { fontSize: 16, fontWeight: 'bold', marginVertical: 15, color: '#333' },
    listSection: { flex: 1 },
    emptyText: { color: '#888', fontStyle: 'italic', marginTop: 10 },
    itemCard: {
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#eee',
    },
    itemTitle: { fontSize: 14, fontWeight: '600', color: '#333', flex: 1, marginRight: 10 },
    itemAmount: { fontSize: 14, fontWeight: 'bold' },
});