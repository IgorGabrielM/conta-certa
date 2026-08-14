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
        const today = new Date();
        const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
            .toISOString()
            .split('T')[0];

        // 1. Buscamos todas as transações recorrentes a partir deste mês
        // Ordenado por due_date decrescente para termos as versões mais no "futuro"
        const { data: activeRecurring, error: fetchError } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .eq('frequency', 'recurring')
            .gte('due_date', startOfThisMonth)
            .order('due_date', { ascending: false });

        if (fetchError) throw fetchError;
        if (!activeRecurring || activeRecurring.length === 0) return;

        // 2. Extraímos a versão MAIS RECENTE de cada recurring_group_id para servir de "molde"
        const uniqueGroups = new Map();
        for (const tx of activeRecurring) {
            if (tx.recurring_group_id && !uniqueGroups.has(tx.recurring_group_id)) {
                uniqueGroups.set(tx.recurring_group_id, tx);
            }
        }

        const modelsToClone = Array.from(uniqueGroups.values());
        const transactionsToInsert = [];

        // 3. Projetamos os próximos 3 meses
        for (let i = 1; i <= 3; i++) {
            const targetYear = today.getFullYear();
            const targetMonth = today.getMonth() + i;

            for (const model of modelsToClone) {
                const modelDate = new Date(model.due_date);
                const originalDay = modelDate.getDate();

                // Cria a data mantendo o dia original
                const targetDate = new Date(targetYear, targetMonth, originalDay);

                // Tratamento de virada de mês (ex: tentar criar dia 31 num mês de 30 dias)
                if (targetDate.getMonth() !== targetMonth % 12) {
                    targetDate.setDate(0); // Força para o último dia do mês alvo
                }

                const targetDateString = targetDate.toISOString().split('T')[0];

                // Somente adiciona se a data projetada for maior que a última data que já temos salva no banco para este grupo
                if (new Date(targetDateString) > new Date(model.due_date)) {
                    transactionsToInsert.push({
                        title: model.title,
                        type: model.type,
                        frequency: 'recurring',
                        amount_expected: model.amount_expected,
                        due_date: targetDateString,
                        category_name: model.category_name,
                        user_id: userId,
                        is_completed: false,
                        recurring_group_id: model.recurring_group_id,
                    });
                }
            }
        }

        // 4. Inserimos todas as que faltam de uma única vez (Bulk Insert)
        if (transactionsToInsert.length > 0) {
            const { error: insertErr } = await supabase
                .from('transactions')
                .insert(transactionsToInsert);

            if (insertErr) throw insertErr;
            console.log(`Geradas ${transactionsToInsert.length} transações recorrentes via Client.`);
        }
    } catch (err) {
        console.error('Erro ao verificar recorrência via App:', err);
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