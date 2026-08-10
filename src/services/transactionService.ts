
import { supabase } from '../config/supabaseClient';
import { saveCustomCategoryLocally, CategoryItem } from './categoryService';
import {TransactionType, TransactionFrequency, Transaction} from '../types/transaction';

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

export async function createOrUpdateTransaction(params: SaveTransactionParams) {
    const {
        id, title, amount, type, frequency, categoryInput,
        availableCategories, hasNoDueDate, selectedDate
    } = params;

    // 1. Validações iniciais
    if (!title || !amount) {
        throw new Error('Preencha o nome e o valor.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('Usuário não autenticado.');
    }

    // 2. Formatação de dados
    const formattedCategory = categoryInput.trim() || 'Geral';
    const formattedDate = hasNoDueDate ? null : selectedDate.toISOString().split('T')[0];

    const sanitizedAmount = amount.replace(/\./g, '').replace(',', '.');
    const numericAmount = parseFloat(sanitizedAmount);

    // 3. Regra de negócio: Salvar categoria customizada se não existir
    const categoryExists = availableCategories.some(
        (cat) => cat.name.toLowerCase() === formattedCategory.toLowerCase()
    );
    if (!categoryExists) {
        await saveCustomCategoryLocally(formattedCategory, type);
    }

    // 4. Montagem do Payload
    const payload = {
        title,
        type,
        frequency,
        amount_expected: numericAmount,
        due_date: formattedDate,
        category_name: formattedCategory,
        user_id: user.id,
    };

    // 5. Persistência no Banco (Update ou Insert)
    if (id) {
        const { data, error } = await supabase
            .from('transactions')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } else {
        const { data, error } = await supabase
            .from('transactions')
            .insert([{ ...payload, is_completed: false }])
            .select()
            .single();

        if (error) throw error;
        return data;
    }
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
export async function deleteTransaction(transaction: Transaction) {
    if (transaction.frequency === 'recurring' && transaction.recurring_group_id) {
        const { error } = await supabase.rpc('delete_recurring_future', {
            p_group_id: transaction.recurring_group_id,
            p_due_date: transaction.due_date
        });
        if (error) throw error;
    } else {
        const { error } = await supabase.from('transactions').delete().eq('id', transaction.id);
        if (error) throw error;
    }
}