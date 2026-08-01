import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabaseClient';

const LOCAL_CATEGORIES_KEY = '@ContaCerta:custom_categories';

export interface CategoryItem {
    id: string;
    name: string;
    type: 'income' | 'expense';
    isCustom?: boolean;
}

// Busca categorias do Supabase + Categorias Salvas Localmente
export async function getMergedCategories(type: 'income' | 'expense'): Promise<CategoryItem[]> {
    try {
        // 1. Categorias Públicas do Supabase
        const { data: dbCategories } = await supabase
            .from('categories')
            .select('id, name, type')
            .eq('type', type);

        const globalCats: CategoryItem[] = (dbCategories || []).map((c) => ({
            id: String(c.id),
            name: c.name,
            type: c.type,
            isCustom: false,
        }));

        // 2. Categorias Locais do AsyncStorage
        const localData = await AsyncStorage.getItem(LOCAL_CATEGORIES_KEY);
        const localCats: CategoryItem[] = localData ? JSON.parse(localData) : [];
        const filteredLocalCats = localCats.filter((c) => c.type === type);

        // 3. Mesclar evitando duplicados (priorizando pelo nome)
        const allCategories = [...globalCats];

        filteredLocalCats.forEach((localCat) => {
            const exists = allCategories.some(
                (c) => c.name.trim().toLowerCase() === localCat.name.trim().toLowerCase()
            );
            if (!exists) {
                allCategories.push(localCat);
            }
        });

        return allCategories.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error('Erro ao buscar categorias mescladas:', error);
        return [];
    }
}

// Salva uma nova categoria customizada localmente no celular
export async function saveCustomCategoryLocally(name: string, type: 'income' | 'expense') {
    try {
        const trimmedName = name.trim();
        if (!trimmedName) return;

        const localData = await AsyncStorage.getItem(LOCAL_CATEGORIES_KEY);
        const localCats: CategoryItem[] = localData ? JSON.parse(localData) : [];

        // Verifica se já existe localmente
        const exists = localCats.some(
            (c) => c.name.toLowerCase() === trimmedName.toLowerCase() && c.type === type
        );

        if (!exists) {
            const newCategory: CategoryItem = {
                id: `local_${Date.now()}`,
                name: trimmedName,
                type,
                isCustom: true,
            };
            localCats.push(newCategory);
            await AsyncStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(localCats));
        }
    } catch (error) {
        console.error('Erro ao salvar categoria localmente:', error);
    }
}