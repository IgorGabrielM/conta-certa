/**
 * Formata uma string no padrão YYYY-MM-DD para DD/MM/YYYY sem sofrer com desvios de Timezone UTC.
 */
export function formatDateBR(dateString?: string | null): string {
    if (!dateString) return '';

    // Pega apenas a parte 'YYYY-MM-DD' caso venha com timestamp completo ISO
    const cleanDate = dateString.split('T')[0];
    const parts = cleanDate.split('-');

    if (parts.length !== 3) return dateString;

    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
}