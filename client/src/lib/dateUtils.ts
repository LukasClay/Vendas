/**
 * Formata uma data para exibição no formato brasileiro (dd/mm/aaaa)
 * sem problema de timezone offset.
 *
 * O banco retorna datas como strings "YYYY-MM-DD" ou objetos Date serializados
 * como "YYYY-MM-DDTHH:mm:ss.sssZ". Ao usar `new Date(str).toLocaleDateString()`
 * em fuso UTC-3, datas como "2026-03-17T00:00:00.000Z" viram "16/03/2026".
 *
 * A solução é extrair os componentes da string diretamente, sem conversão de fuso.
 */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";

  // Se for objeto Date, serializar para ISO e extrair a parte da data
  const str = d instanceof Date ? d.toISOString() : String(d);

  // Extrai "YYYY-MM-DD" do início da string (funciona para ISO e para strings puras)
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return str;

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
