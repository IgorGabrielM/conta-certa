📱 Documentação do Projeto: App de Gestão Financeira Pessoal

Documentação abrangente sobre a arquitetura, modelo de dados, serviços e fluxos de telas do aplicativo de finanças pessoais desenvolvido com React Native (Expo), TypeScript e Supabase.
📋 Sumário

    Visão Geral do Projeto

    Stack Tecnológica

    Estrutura do Projeto

    Modelo de Banco de Dados (Supabase)

    Tipagem TypeScript

    Módulos e Serviços

    Telas do Aplicativo

    Regras de Negócio e UX

    Guia de Configuração e Instalação

🎯 Visão Geral do Projeto

O aplicativo foi projetado para permitir que usuários gerenciem suas entradas (receitas) e saídas (despesas) de forma simples, rápida e responsiva. O foco da experiência do usuário está na agilidade ao registrar e concluir lançamentos, com sincronização em nuvem e suporte offline/local para sugestões personalizadas.
Destaques Principais:

    Autenticação Multi-usuário: Isolamento total de dados por usuário via Supabase RLS (Row Level Security).

    Gestão de Lançamentos: Cadastro de despesas e receitas com valores previstos/reais e controle de vencimento.

    Sistema Inteligente de Categorias: Integração entre categorias padrão do sistema e categorias personalizadas salvas localmente por usuário.

    Atualização Otimista (Optimistic UI): Mudanças de status (pendente/concluído) e exclusões acontecem instantaneamente na tela com animações fluidas, salvando em segundo plano.

    Suporte Multiplataforma: Compatibilidade total com iOS, Android e Web (incluindo input de data nativo para web).

🛠 Stack Tecnológica

    Front-end: React Native (com Expo Managed Workflow)

    Linguagem: TypeScript

    Navegação: React Navigation (Bottom Tabs / Stack Navigation)

    Backend & Banco de Dados: Supabase (PostgreSQL + Auth)

    Armazenamento Local: @react-native-async-storage/async-storage

    Seleção de Datas: @react-native-community/datetimepicker

    Ícones: @expo/vector-icons (Ionicons)

    Animações Nativas: LayoutAnimation (React Native)

📁 Estrutura do Projeto
Plaintext

src/
├── config/
│   └── supabaseClient.ts       # Inicialização do cliente Supabase
├── types/
│   ├── transaction.ts          # Interfaces e tipos para Transações
│   └── category.ts             # Interfaces para Categorias
├── services/
│   └── categoryService.ts      # Serviço de merge entre categorias padrão e customizadas
├── screens/
│   ├── HomeScreen.tsx          # Dashboard / Resumo financeiro
│   └── TransactionsScreen.tsx  # Listagem, filtro, marcação e criação de lançamentos
└── navigation/
└── AppNavigator.tsx        # Configuração de rotas e navegação por abas

🗄 Modelo de Banco de Dados (Supabase)
Tabela: transactions

Armazena todos os lançamentos financeiros vinculados aos usuários.
Coluna	Tipo	Nulo?	Padrão	Descrição
id	uuid	Não	gen_random_uuid()	Chave primária da transação.
user_id	uuid	Não	—	Foreign Key apontando para auth.users(id).
title	text	Não	—	Nome/descrição da transação (ex: "Aluguel").
type	text	Não	—	Tipo de transação: 'Entrada' ou 'Saída'.
amount_expected	numeric	Não	—	Valor previsto/planejado para a transação.
amount_actual	numeric	Sim	null	Valor real pago/recebido (preenchido ao concluir).
due_date	date	Não	—	Data de vencimento no formato YYYY-MM-DD.
completed_at	date	Sim	null	Data em que a transação foi concluída.
is_completed	boolean	Não	false	Status da transação (concluída ou pendente).
category_name	text	Não	'Geral'	Nome da categoria associada.
created_at	timestamptz	Não	now()	Data/hora de criação do registro.
📐 Tipagem TypeScript
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
due_date: string;
completed_at?: string | null;
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

⚙️ Módulos e Serviços
1. Cliente Supabase (src/config/supabaseClient.ts)

Configura a conexão com o projeto no Supabase usando a URL e a Anon Key públicas.
2. Serviço de Categorias (src/services/categoryService.ts)

Gerencia o carregamento de categorias padrão e a mesclagem com as categorias criadas pelo usuário (salvas via AsyncStorage).

    Categorias Padrão de Saída: Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, Compras, Outros.

    Categorias Padrão de Entrada: Salário, Freelance, Investimentos, Presente, Outros.

    Persistência: Quando o usuário insere uma nova categoria ao criar um lançamento, ela é salva com a chave @custom_categories_v1 para aparecer no autocomplete das próximas vezes.

🖥 Telas do Aplicativo
1. TransactionsScreen.tsx (Tela Principal de Lançamentos)

A tela principal do sistema oferece controle total sobre as contas a pagar e receber.
Recursos e Funcionalidades:

    Listagem Dinâmica e Reordenação:

        Exibe lançamentos ordenados por status (pendentes no topo, concluídos ao final) e por data de vencimento.

        Lançamentos concluídos possuem estilo visual diferenciado (texto tachado e opacidade reduzida).

    Filtros por Estado:

        Todos: Exibe todos os lançamentos.

        Pendentes: Exibe apenas os que possuem is_completed = false.

        Concluídos: Exibe apenas os que possuem is_completed = true.

    Marcação Otimista (Checkbox / Toggle Status):

        Sem estado de Loading na tela: Ao clicar no checkbox, o item é atualizado imediatamente no estado local do React.

        Animação Fluid (LayoutAnimation): O item desliza suavemente para a seção de concluídos no final da lista.

        Sincronização em Segundo Plano: A alteração é gravada no Supabase sem recarregar a lista. Caso a requisição falhe, o estado é revertido automaticamente.

    Modal de Novo Lançamento:

        Tipo: Botões para alternar entre Saída (vermelho) e Entrada (verde).

        Nome e Valor: Validação de campos obrigatórios.

        Autocomplete Inteligente de Categoria: Ao focar/digitar, exibe uma lista flutuante de categorias pré-definidas e customizadas salvas previamente.

        Seletor de Data Híbrido: Utiliza o picker nativo no Android/iOS e o <input type="date"> padrão no ambiente Web.

    Exclusão Rápida:

        Botão de lixeira em cada item que remove a transação instantaneamente da interface com animação e confirma a deleção no banco.

💡 Regras de Negócio e UX

    Valores Previstos vs. Reais:

        Todo lançamento nasce com um valor previsto (amount_expected).

        Quando o lançamento é marcado como concluído, o sistema preenche automaticamente o valor real (amount_actual = amount_expected) e grava a data atual no campo completed_at.

        Ao desmarcar como concluído, amount_actual e completed_at retornam para null.

    Garantia de Atualização de Tela (Focus Effect):

        O hook useFocusEffect é utilizado para recarregar os dados do banco sempre que o usuário navega de volta para a tela de lançamentos, garantindo consistência.

    Tratamento Multiplataforma (Web / Mobile):

        O suporte ao LayoutAnimation do React Native é configurado condicionalmente para funcionar sem quebras no Android via UIManager.setLayoutAnimationEnabledExperimental.

        Entradas de formulário e componentes de data adaptam-se dinamicamente para garantir bom funcionamento na Web e nos dispositivos móveis.

🚀 Guia de Configuração e Instalação
Pré-requisitos

    Node.js (v18+)

    Gerenciador de pacotes (npm ou yarn)

    Expo Go instalado no dispositivo físico ou simulador/emulador configurado

1. Clonar o repositório e instalar dependências
   Bash

npm install

2. Configurar Variáveis de Ambiente

Crie um arquivo .env na raiz do projeto (ou configure dentro de src/config/supabaseClient.ts):
Snippet de código

EXPO_PUBLIC_SUPABASE_URL=https://sua-url.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-key

3. Executar o Projeto
   Bash

# Iniciar servidor Expo
npx expo start

# Executar na Web
npx expo start --web
