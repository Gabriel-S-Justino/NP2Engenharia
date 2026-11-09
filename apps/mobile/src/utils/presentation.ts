/** Tradução visual de mensagens técnicas; não muda estados, respostas ou decisões da API. */
export function userFacingText(message: string): string {
  if (message.startsWith('O modelo principal estava indisponível;')) {
    return 'Usamos uma alternativa de IA para concluir esta resposta.';
  }
  return message
    .replace(/\s*\(HTTP \d{3}[^)]*\)/g, '')
    .replace(/Indexar pasta/g, 'Preparar documentos')
    .replace(/indexação/g, 'preparação')
    .replace(/indexados/g, 'preparados');
}
