export type TransactionType = 'income' | 'expense';

export interface Category {
    id: string;
    name: string;
    type: TransactionType;
}

export interface Transaction {
    id: string;
    title: string;
    type: 'income' | 'expense';
    frequency: 'recurring' | 'extra';
    amount_expected: number;
    amount_actual?: number | null;
    due_date: string;
    completed_at?: string | null;
    is_completed: boolean;
    category_name?: string | null;
    user_id: string;
}

export interface MonthlySummary {
    month: string;
    total_income_actual: number;
    total_income_pending: number;
    total_outcome_actual: number;
    total_outcome_pending: number;
    remaining_balance: number;
}