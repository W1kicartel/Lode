// I servizi della «tua AI»: base dell'API in formato OpenAI, quali modelli preferire (dal più adatto), dove si crea la
// chiave, una nota. Un elenco solo, importato da js/ai.js (la barra) e da desktop/main.mjs: nell'app le chiamate passano
// dal main, che accetta dalla barra solo l'id del servizio e sceglie lui la base da qui (mai un indirizzo deciso dalla
// barra). Le stesse origini sono in connect-src della Content-Security-Policy di index.html (test/unita.mjs controlla).
export const FORNITORI = {
  anthropic: { nome: 'Claude', ditta: 'Anthropic', sito: 'console.anthropic.com', segnaposto: 'sk-ant-…', nota: 'Il più bravo a spiegare e a interrogare; propone anche carte, esami e voti da confermare.' },
  openai: { nome: 'ChatGPT', ditta: 'OpenAI', base: 'https://api.openai.com/v1', sito: 'platform.openai.com/api-keys', segnaposto: 'sk-…', preferiti: [/^gpt-5(\.\d+)?-mini$/, /^gpt-5(\.\d+)?$/, /^gpt-4\.1-mini$/, /^gpt-4o-mini$/], nota: 'A consumo, pochi centesimi a sessione.' },
  google: { nome: 'Gemini', ditta: 'Google', base: 'https://generativelanguage.googleapis.com/v1beta/openai', sito: 'aistudio.google.com/apikey', segnaposto: 'AIza…', preferiti: [/^gemini-\d+(\.\d+)?-flash$/, /^gemini-\d+(\.\d+)?-flash-latest$/, /^gemini-[\d.]+-flash/, /^gemini-[\d.]+-pro$/], nota: 'Ha un piano gratuito con limiti; nel piano gratuito Google può usare i testi per migliorare i suoi modelli.' },
  mistral: { nome: 'Mistral', ditta: 'Mistral AI (Francia)', base: 'https://api.mistral.ai/v1', sito: 'console.mistral.ai/api-keys', segnaposto: '', preferiti: [/^mistral-medium-latest$/, /^mistral-small-latest$/, /^mistral-large-latest$/], nota: 'Europeo, server in Europa.' },
  groq: { nome: 'Groq', ditta: 'Groq', base: 'https://api.groq.com/openai/v1', sito: 'console.groq.com/keys', segnaposto: 'gsk_…', preferiti: [/^openai\/gpt-oss-120b$/, /^qwen\/qwen3/, /^llama-3\.3-70b/, /^meta-llama\/llama-4/], nota: 'Velocissimo, modelli aperti; ha un piano gratuito con limiti.' },
  openrouter: { nome: 'OpenRouter', ditta: 'OpenRouter', base: 'https://openrouter.ai/api/v1', sito: 'openrouter.ai/keys', segnaposto: 'sk-or-…', preferiti: [/^openrouter\/auto$/], nota: 'Una chiave per centinaia di modelli, anche gratuiti.' },
  deepseek: { nome: 'DeepSeek', ditta: 'DeepSeek', base: 'https://api.deepseek.com', sito: 'platform.deepseek.com/api_keys', segnaposto: 'sk-…', preferiti: [/^deepseek-chat$/], nota: 'Molto economico; server in Cina.' },
};
// Claude non è in formato OpenAI: la barra chiama api.anthropic.com direttamente (js/ai.js)
export const ORIGINE_CLAUDE = 'https://api.anthropic.com';
// la base di un servizio, solo se è nell'elenco (null per Claude e per gli id sconosciuti)
export const baseDi = id => Object.hasOwn(FORNITORI, String(id)) && FORNITORI[id].base || null;
// le origini a cui la barra può parlare per la «tua AI» (per la Content-Security-Policy)
export const originiAI = () => [ORIGINE_CLAUDE, ...Object.values(FORNITORI).filter(f => f.base).map(f => new URL(f.base).origin)];
