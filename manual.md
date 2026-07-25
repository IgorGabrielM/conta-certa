🤖 System Prompt & Context Map: React Native + Supabase Financial App

    Para IAs/LLMs: Este documento é o mapa de contexto técnico do projeto. Leia as regras, arquitetura, convenções e o esquema de banco de dados abaixo antes de propor alterações, criar telas ou refatorar código.

1. 📌 Contexto Geral & Arquitetura

   Tipo de Projeto: Aplicativo Mobile de Gestão Financeira Pessoal.

   Stack:

        Framework: React Native (Expo Managed Workflow / TypeScript).

        Backend: Supabase (PostgreSQL, Auth com Row Level Security - RLS).

        Storage Local: @react-native-async-storage/async-storage.

        Navegação: @react-navigation/native (Stack / Bottom Tabs).

        Plataformas: iOS, Android e Web.

2. 🗄️ Esquema do Banco de Dados (Supabase)

A tabela principal do aplicativo chama-se transactions.
Tabela transactions
SQL

CREATE TABLE public.transactions (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
title TEXT NOT NULL,
type TEXT NOT NULL CHECK (type IN ('Entrada', 'Saída')),
amount_expected NUMERIC(10,2) NOT NULL,
amount_actual NUMERIC(10,2) DEFAULT NULL,
due_date DATE NOT NULL,
completed_at DATE DEFAULT NULL,
is_completed BOOLEAN NOT NULL DEFAULT false,
category_name TEXT NOT NULL DEFAULT 'Geral',
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

3. 📐 Tipagem Estrita em TypeScript
   src/types/transaction.ts
   TypeScript

export type TransactionType = 'Entrada' | 'Saída';

export interface Transaction {
id: string;
user_id: string;
title: string;
type: TransactionType;
amount_expected: number;
amount_actual?: number | null;
due_date: string; // Formato 'YYYY-MM-DD'
completed_at?: string | null; // Formato 'YYYY-MM-DD'
is_completed: boolean;
category_name: string;
created_at?: string;
}

src/types/category.ts
TypeScript

import { TransactionType } from './transaction';

export interface CategoryItem {
id: string;
name: string;
type: TransactionType;
isCustom?: boolean;
}

4. 🚨 Diretrizes de UX e Regras do Código (MUITO IMPORTANTE PARA IAs)
   ⚠️ Regra #1: Mudança de Estado de Checkbox (Optimistic Updates)

   NUNCA chame fetchTransactions() dentro de toggleTransactionStatus se ela disparar um spinner global (loading = true).

   Sempre atualize o estado local setTransactions(...) instantaneamente.

   Dispare a requisição ao Supabase em segundo plano. Reverta a alteração local somente se o banco retornar erro.

   Mantenha o uso de LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut) para reordenar a lista sem sobressaltos visuais.

⚠️ Regra #2: Regra de Negócio de Conclusão de Transação

Ao marcar uma transação como concluída (is_completed = true):

    amount_actual deve ser preenchido automaticamente com o valor de amount_expected.

    completed_at recebe a data atual (YYYY-MM-DD).

    Ao desmarcar (is_completed = false), ambos amount_actual e completed_at voltam a ser null.

⚠️ Regra #3: Tratamento Multiplataforma

    Sempre inclua o suporte a Android para animações:
    TypeScript

    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    Se o ambiente for Web (Platform.OS === 'web'), utilize componentes nativos compatíveis (ex: <input type="date"> no lugar do @react-native-community/datetimepicker).

5. 📂 Estrutura de Arquivos
   Plaintext

src/
├── config/
│   └── supabaseClient.ts       # Inicialização do Supabase
├── types/
│   ├── transaction.ts          # Interfaces de dados
│   └── category.ts
├── services/
│   └── categoryService.ts      # Lógica de mesclagem entre categorias do sistema e do AsyncStorage
├── screens/
│   └── TransactionsScreen.tsx  # Tela principal de CRUD e listagem
└── navigation/
└── AppNavigator.tsx        # Rotas

6. 🔄 Código Atual de Referência (TransactionsScreen.tsx)

Para evitar reescrever padrões e manter a consistência, consulte a estrutura da tela principal:
TypeScript

// Principais estados da tela:
const [transactions, setTransactions] = useState<Transaction[]>([]);
const [loading, setLoading] = useState(true);
const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'DONE'>('ALL');

// Padrão de atualização otimista usado no projeto:
async function toggleTransactionStatus(item: Transaction) {
const newStatus = !item.is_completed;
const newAmountActual = newStatus ? item.amount_expected : null;
const updatedCompletedAt = newStatus ? new Date().toISOString().split('T')[0] : null;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    // 1. Atualização local instantânea
    setTransactions((prevList) => {
        const updated = prevList.map((t) =>
            t.id === item.id
                ? { ...t, is_completed: newStatus, amount_actual: newAmountActual, completed_at: updatedCompletedAt }
                : t
        );
        return updated.sort((a, b) => (a.is_completed === b.is_completed ? 0 : a.is_completed ? 1 : -1));
    });

    // 2. Persistência em segundo plano
    const { error } = await supabase
        .from('transactions')
        .update({
            is_completed: newStatus,
            amount_actual: newAmountActual,
            completed_at: updatedCompletedAt,
        })
        .eq('id', item.id);

    if (error) fetchTransactions(); // Reverte apenas em falhas
}

🤖 Instruções para a IA ao Modificar Este Projeto

    Mantenha os nomes de tabelas e colunas em snake_case ao interagir com o Supabase (is_completed, amount_expected, due_date, etc.).

    Mantenha as propriedades do frontend em camelCase no TypeScript (is_completed, amountExpected, etc., mantendo o mapeamento correto).

    Nunca quebre a fluidez visual adicionando indicadores de carregamento (spinners/loadings) para ações simples de toggle ou exclusão.

    Respeite as regras de acessibilidade e estilização em React Native usando StyleSheet.create.