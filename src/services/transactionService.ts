
import { supabase } from '../config/supabaseClient';
import { saveCustomCategoryLocally, CategoryItem } from './categoryService';
import {TransactionType, TransactionFrequency, Transaction} from '../types/transaction';
import AsyncStorage from "@react-native-async-storage/async-storage";

// Definimos uma interface com tudo o que o serviço precisa receber da UI
export interface SaveTransactionParams {
    id?: string;
    title: string;
    amount: string;
    type: TransactionType;
    frequency: TransactionFrequency;
    categoryInput: string;
    availableCategories: CategoryItem[];
    hasNoDueDate: boolean;
    selectedDate: Date;
    updateFuture?: boolean; // <--- Adicione esta linha aqui
}

const PAYDAY_STORAGE_KEY = '@user_payday';

export async function createOrUpdateTransaction(
    params: SaveTransactionParams
) {
    const {
        id,
        title,
        amount,
        type,
        frequency,
        categoryInput,
        availableCategories,
        hasNoDueDate,
        selectedDate,
        updateFuture = false,
    } = params;

    // ========================================================
    // 1. VALIDAÇÕES
    // ========================================================

    if (!title || !amount) {
        throw new Error('Preencha o nome e o valor.');
    }

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Usuário não autenticado.');
    }

    // ========================================================
    // 2. FORMATAÇÃO
    // ========================================================

    const formattedCategory =
        categoryInput.trim() || 'Geral';

    const formattedDate = hasNoDueDate
        ? null
        : selectedDate.toISOString().split('T')[0];

    const sanitizedAmount = amount
        .replace(/\./g, '')
        .replace(',', '.');

    const numericAmount = parseFloat(sanitizedAmount);

    if (isNaN(numericAmount)) {
        throw new Error('Valor inválido.');
    }

    // ========================================================
    // 3. CATEGORIA CUSTOMIZADA
    // ========================================================

    const categoryExists = availableCategories.some(
        (cat) =>
            cat.name.toLowerCase() ===
            formattedCategory.toLowerCase()
    );

    if (!categoryExists) {
        await saveCustomCategoryLocally(
            formattedCategory,
            type
        );
    }

    // ========================================================
    // 4. NOVA TRANSAÇÃO
    // ========================================================

    if (!id) {
        /*
         * Toda nova recorrência recebe um UUID próprio.
         *
         * Todas as parcelas futuras dessa recorrência deverão
         * utilizar exatamente o mesmo recurring_group_id.
         */
        const recurringGroupId =
            frequency === 'recurring'
                ? crypto.randomUUID()
                : null;

        const payload = {
            title,
            type,
            frequency,
            amount_expected: numericAmount,
            due_date: formattedDate,
            category_name: formattedCategory,
            user_id: user.id,
            is_completed: false,
            recurring_group_id: recurringGroupId,
        };

        const { data, error } = await supabase
            .from('transactions')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;

        return data;
    }

    // ========================================================
    // 5. BUSCAR TRANSAÇÃO ATUAL
    // ========================================================

    const {
        data: currentTransaction,
        error: currentError,
    } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

    if (currentError) {
        throw currentError;
    }

    if (!currentTransaction) {
        throw new Error('Transação não encontrada.');
    }

    // ========================================================
    // 6. DETERMINAR RECURRING GROUP
    // ========================================================

    let recurringGroupId =
        currentTransaction.recurring_group_id ?? null;

    /*
     * Se a transação é recorrente mas ainda não possui
     * recurring_group_id (caso das suas transações antigas),
     * criamos um grupo para ela.
     */
    if (
        currentTransaction.frequency === 'recurring' &&
        !recurringGroupId
    ) {
        recurringGroupId = crypto.randomUUID();

        const { error: groupError } = await supabase
            .from('transactions')
            .update({
                recurring_group_id: recurringGroupId,
            })
            .eq('id', id)
            .eq('user_id', user.id);

        if (groupError) {
            throw groupError;
        }
    }

    // ========================================================
    // 7. ATUALIZAR ESTA + FUTURAS
    // ========================================================

    if (
        updateFuture &&
        currentTransaction.frequency === 'recurring' &&
        recurringGroupId &&
        currentTransaction.due_date
    ) {
        const { data, error } = await supabase.rpc(
            'update_recurring_future',
            {
                p_transaction_id: id,
                p_group_id: recurringGroupId,
                p_due_date: currentTransaction.due_date,
                p_title: title,
                p_amount_expected: numericAmount,
                p_type: type,
                p_frequency: frequency,
                p_category_name: formattedCategory,
                p_due_date_new: formattedDate,
            }
        );

        if (error) {
            console.error(
                'Erro ao atualizar transações recorrentes:',
                error
            );

            throw error;
        }

        return data;
    }

    // ========================================================
    // 8. ATUALIZAR SOMENTE ESTA
    // ========================================================

    const payload = {
        title,
        type,
        frequency,
        amount_expected: numericAmount,
        due_date: formattedDate,
        category_name: formattedCategory,
        recurring_group_id:
            frequency === 'recurring'
                ? recurringGroupId
                : null,
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) throw error;

    return data;
}

// --- BUSCAR TRANSAÇÕES ---
export async function fetchTransactions(): Promise<Transaction[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

// --- ALTERNAR STATUS (CONCLUÍDO / PENDENTE) ---
export async function toggleTransactionStatus(item: Transaction) {
    const newStatus = !item.is_completed;
    const newAmountActual = newStatus ? item.amount_expected : null;
    const updatedCompletedAt = newStatus ? new Date().toISOString().split('T')[0] : null;

    const { error } = await supabase.from('transactions')
        .update({
            is_completed: newStatus,
            amount_actual: newAmountActual,
            completed_at: updatedCompletedAt
        })
        .eq('id', item.id);

    if (error) throw error;
}

// --- EXCLUIR TRANSAÇÃO ---
// Exemplo de lógica para sua função de Deletar no serviço
export async function deleteTransaction(
    transaction: Transaction,
    deleteFuture: boolean = false
) {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Usuário não autenticado.');
    }

    // ========================================================
    // EXCLUIR ESTA + FUTURAS
    // ========================================================

    if (
        deleteFuture &&
        transaction.frequency === 'recurring' &&
        transaction.recurring_group_id &&
        transaction.due_date
    ) {
        const { error } = await supabase.rpc(
            'delete_recurring_future',
            {
                p_group_id:
                transaction.recurring_group_id,
                p_due_date:
                transaction.due_date,
            }
        );

        if (error) {
            console.error(
                'Erro ao excluir recorrentes:',
                error
            );

            throw error;
        }

        return;
    }

    // ========================================================
    // EXCLUIR SOMENTE ESTA
    // ========================================================

    const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction.id)
        .eq('user_id', user.id);

    if (error) throw error;
}

export const getSalaryCycleDates = async () => {
    const savedPayDay = await AsyncStorage.getItem(PAYDAY_STORAGE_KEY);

    const payDay = Number(savedPayDay);

    if (!payDay || payDay < 1 || payDay > 31) {
        const today = new Date();

        return {
            startDate: new Date(
                today.getFullYear(),
                today.getMonth(),
                1
            ),
            endDate: new Date(
                today.getFullYear(),
                today.getMonth() + 1,
                0,
                23,
                59,
                59
            ),
        };
    }

    const today = new Date();

    let startDate: Date;
    let endDate: Date;

    if (today.getDate() >= payDay) {
        startDate = new Date(
            today.getFullYear(),
            today.getMonth(),
            payDay
        );

        endDate = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            payDay - 1,
            23,
            59,
            59
        );
    } else {
        startDate = new Date(
            today.getFullYear(),
            today.getMonth() - 1,
            payDay
        );

        endDate = new Date(
            today.getFullYear(),
            today.getMonth(),
            payDay - 1,
            23,
            59,
            59
        );
    }

    return { startDate, endDate };
};