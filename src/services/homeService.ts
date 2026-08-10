import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabaseClient';

const PAYDAY_STORAGE_KEY = '@user_payday';
const LAST_RECURRING_CHECK_KEY = '@last_recurring_check';

export interface ExtendedMonthlySummary {
    total_income_actual: number;
    total_outcome_actual: number;
    total_outcome_today: number;
    total_income_pending: number;
    total_outcome_pending: number;
    remaining_balance: number;
}

// 1. Verificação de transações recorrentes
export async function checkAndGenerateRecurringTransactions(userId: string) {
    try {
        // 1. Busca a data mais futura de transações recorrentes
        const { data: latestTransaction, error: fetchError } = await supabase
            .from('transactions')
            .select('due_date')
            .eq('user_id', userId)
            .eq('frequency', 'recurring')
            .order('due_date', { ascending: false })
            .limit(1)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        const today = new Date();
        const threeMonthsFromNow = new Date();
        threeMonthsFromNow.setMonth(today.getMonth() + 3);

        const latestDate = latestTransaction ? new Date(latestTransaction.due_date) : today;

        // 2. Compara se a última transação gerada ainda não alcançou o horizonte de 3 meses
        if (latestDate < threeMonthsFromNow) {

            // Calculamos quantos meses faltam preencher até o limite de 3
            // Se latestDate for hoje, i=0 é o mês atual, precisamos gerar os próximos 3.
            for (let i = 1; i <= 3; i++) {
                const targetDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
                const targetDateString = targetDate.toISOString().split('T')[0];

                const { error: rpcError } = await supabase.rpc('generate_monthly_recurring_transactions', {
                    p_user_id: userId,
                    p_target_date: targetDateString
                });

                if (rpcError) {
                    console.error(`Erro ao gerar mês ${targetDateString}:`, rpcError);
                } else {
                    console.log(`Gerado com sucesso para: ${targetDateString}`);
                }
            }
        }
    } catch (err) {
        console.error('Erro ao verificar recorrência:', err);
    }
}

// 2. Busca principal dos dados da Home
export async function fetchHomeSummary() {
    const savedPayDay = await AsyncStorage.getItem(PAYDAY_STORAGE_KEY);
    const currentPayDay = savedPayDay ? parseInt(savedPayDay, 10) : 1;

    const {
        data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            summary: null,
            payDay: currentPayDay
        };
    }

    await checkAndGenerateRecurringTransactions(user.id);

    const { data: summaryData, error } = await supabase
        .rpc('get_monthly_summary', {
            p_user_id: user.id,
            p_pay_day: currentPayDay,
        })
        .maybeSingle();

    if (error) {
        throw error;
    }

    return {
        summary: summaryData as ExtendedMonthlySummary,
        payDay: currentPayDay
    };
}

// 3. Cálculo de dias restantes até o pagamento
export function getDaysUntilNextPayday(payDayOfMonth: number) {
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
    return Math.max(1, Math.ceil(diffInTime / (1000 * 3600 * 24)));
}

// 4. Cálculo do orçamento diário
export function calculateDailyBudget(summaryData: ExtendedMonthlySummary | null, payDay: number) {
    const totalDaysLeft = getDaysUntilNextPayday(payDay);

    if (!summaryData || totalDaysLeft <= 0) {
        return {
            dailyAvailable: '0.00',
            nextDaysBudget: '0.00',
            daysLeft: totalDaysLeft,
            freeProjectedBalance: 0
        };
    }

    const actualBalance = summaryData.remaining_balance ?? 0;
    const pendingIncome = summaryData.total_income_pending ?? 0;
    const pendingOutcome = summaryData.total_outcome_pending ?? 0;
    const spentToday = summaryData.total_outcome_today ?? 0;

    const freeProjectedBalance = actualBalance + pendingIncome - pendingOutcome;
    const dailyTarget = freeProjectedBalance / totalDaysLeft;
    const dailyAvailableVal = dailyTarget - spentToday;

    return {
        dailyAvailable: dailyAvailableVal.toFixed(2),
        nextDaysBudget: dailyTarget.toFixed(2),
        daysLeft: totalDaysLeft,
        freeProjectedBalance: freeProjectedBalance
    };
}