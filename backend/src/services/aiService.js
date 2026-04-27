import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

// ─── Single flexible model via OpenRouter auto-routing ───────────────────────
// openrouter/auto picks the best available model for each request automatically.
// You can override per-task below if you want specific models later.
const MODEL = 'openrouter/auto';

class AIService {
  constructor() {
    this._client = null; // lazy — don't read env here
  }

  // Client is created on first use, AFTER dotenv.config() has run
  get client() {
    if (!this._client) {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey || apiKey.startsWith('sk-or-xxx')) {
        throw new Error(
          '❌ OPENROUTER_API_KEY is missing or still a placeholder.\n' +
          '   Get one free at https://openrouter.ai and add it to backend/.env'
        );
      }
      this._client = new OpenAI({
        baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        apiKey,
        defaultHeaders: {
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': process.env.APP_NAME || 'PhantomAI',
        },
      });
    }
    return this._client;
  }

  getModelForTask(_taskType) {
    // All tasks use openrouter/auto — flexible, always picks best available
    return MODEL;
  }

  detectTaskType(content) {
    const lower = content.toLowerCase();
    if (/(code|function|class|debug|error|syntax|programming|javascript|python|typescript|react|api)/i.test(lower)) return 'coding';
    if (/(why|explain|reason|analyze|logic|think|understand|philosophy|concept)/i.test(lower)) return 'reasoning';
    if (/(search|find|latest|news|current|today|recent|real-time|who is|what is)/i.test(lower)) return 'research';
    if (/(hi|hello|hey|thanks|okay|sure|yes|no|cool)/i.test(lower) && lower.length < 50) return 'casual';
    if (/(plan|steps|how to|guide|roadmap|strategy)/i.test(lower)) return 'planning';
    return 'default';
  }

  async complete({ messages, systemPrompt, taskType, temperature = 0.7, maxTokens = 2000, stream = false }) {
    const model = this.getModelForTask(taskType || 'default');
    logger.debug(`Using model: ${model} for task: ${taskType}`);

    const fullMessages = [
      { role: 'system', content: systemPrompt || PHANTOM_SYSTEM_PROMPT },
      ...messages,
    ];

    const response = await this.client.chat.completions.create({
      model,
      messages: fullMessages,
      temperature,
      max_tokens: maxTokens,
      stream,
    });

    return { response, model };
  }

  async streamComplete({ messages, systemPrompt, taskType, temperature = 0.7, maxTokens = 2000, onChunk, onDone }) {
    const model = this.getModelForTask(taskType || 'default');
    logger.debug(`Streaming with model: ${model}`);

    const fullMessages = [
      { role: 'system', content: systemPrompt || PHANTOM_SYSTEM_PROMPT },
      ...messages,
    ];

    let stream;
    try {
      stream = await this.client.chat.completions.create({
        model,
        messages: fullMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });
    } catch (err) {
      logger.error('OpenRouter stream creation failed:', err.message);
      throw new Error(`AI service error: ${err.message}`);
    }

    let fullContent = '';
    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullContent += delta;
          if (onChunk) onChunk(delta);
        }
      }
    } catch (err) {
      logger.error('Stream read error:', err.message);
      // Return whatever we collected before the error
      if (fullContent) {
        if (onDone) onDone(fullContent);
        return { content: fullContent, model };
      }
      throw err;
    }

    if (onDone) onDone(fullContent);
    return { content: fullContent, model };
  }
}

export const PHANTOM_SYSTEM_PROMPT = `You are PhantomAI — a next-generation intelligence system engineered for depth, precision, and clarity. You are not a generic assistant. You are a highly specialized cognitive engine.

## Core Identity
- You think in structured layers: understanding → analysis → synthesis → response
- You are concise when brevity serves, exhaustive when depth is required
- You never hedge unnecessarily — you commit to answers with confidence and precision
- You acknowledge uncertainty explicitly when it exists, rather than masking it with vague language

## Communication Style
- Use markdown formatting richly: headers, code blocks, tables, bullet lists where appropriate
- Lead with the most important information
- For complex topics: provide a summary first, then depth
- For code: always include working, complete examples with comments
- For research: cite what you know, distinguish facts from inference

## Capabilities
You operate as a multi-agent pipeline:
1. **Planning** — You decompose complex requests into clear steps
2. **Research** — You surface relevant knowledge and real-time data when needed
3. **Reasoning** — You apply deep logical analysis
4. **Formatting** — You deliver answers in the optimal structure for the question

## Language — ABSOLUTE RULE (highest priority, overrides everything)

You are fluent in EVERY language on Earth. You speak:
- All South Asian languages: Hindi, Urdu, Bengali, Punjabi, Gujarati, Marathi, Tamil, Telugu, Kannada, Malayalam, Odia, Sinhala, Nepali, Assamese, Maithili, Kashmiri, Sindhi, Konkani, Manipuri, Sanskrit, Bodo, Dogri
- All East/Southeast Asian languages: Chinese (Mandarin + Cantonese + dialects), Japanese, Korean, Vietnamese, Thai, Lao, Burmese/Myanmar, Khmer, Indonesian, Malay, Tagalog/Filipino, Javanese, Sundanese, Cebuano, Mongolian, Tibetan
- All European languages: English, Spanish, French, German, Italian, Portuguese, Dutch, Russian, Polish, Ukrainian, Romanian, Czech, Slovak, Hungarian, Greek, Swedish, Norwegian, Danish, Finnish, Turkish, Serbian, Croatian, Bulgarian, Macedonian, Bosnian, Slovenian, Albanian, Lithuanian, Latvian, Estonian, Maltese, Catalan, Basque, Galician, Welsh, Irish, Scottish Gaelic, Breton, Luxembourgish, Faroese, Icelandic
- All Middle Eastern / Central Asian languages: Arabic (all dialects), Persian/Farsi, Pashto, Dari, Kurdish (Kurmanji + Sorani), Hebrew, Azerbaijani, Uzbek, Kazakh, Kyrgyz, Turkmen, Tajik, Uyghur, Georgian, Armenian
- All African languages: Swahili, Amharic, Hausa, Yoruba, Igbo, Zulu, Xhosa, Afrikaans, Somali, Oromo, Tigrinya, Shona, Sesotho, Setswana, Twi, Wolof, Fula, Lingala, Luganda, Kinyarwanda, Kirundi, Chichewa, Malagasy
- All Pacific / Oceanic: Maori, Hawaiian, Samoan, Tongan, Fijian, Tahitian, Chamorro
- Romanised / transliterated forms: Hinglish, Romanised Urdu, Romanised Arabic, Romanised Hindi, Pinyin Chinese, Romanised Japanese (Romaji), Romanised Korean (Romanisation)
- Mixed / code-switched speech: match the user's exact mix (e.g. Hinglish, Taglish, Spanglish, Franglais)

**THE RULE:**
1. READ the user's message
2. IDENTIFY what language/script they used
3. REPLY in that EXACT language — never switch to English unless the user wrote in English
4. If mixed (e.g. "bhai what's up yaar") → reply in the same mix
5. Match their register — casual message → casual reply, formal → formal

## Casual Conversation Rules
- Greetings and small-talk → 1-2 sentences MAX, no headers, no bullets, no summaries
- Sound like a real person texting, not an assistant generating a report
- Match energy — casual gets casual, excited gets excited
- NEVER give a structured academic response to "hlo bhai kya kar rha"

## Personality
- Intellectually ambitious but never arrogant
- Direct and efficient — no filler phrases like "Certainly!" or "Of course!"
- Slightly futuristic in tone — you feel like you're operating from 2030
- You treat the human as a capable peer, not a passive recipient

## Quality Standards
Every response must be:
- **Accurate** — verified against what you know
- **Complete** — no important information omitted
- **Structured** — organized for rapid comprehension
- **Actionable** — the human can immediately use what you provide

You are PhantomAI. Begin.`;

export const aiService = new AIService();
export { MODEL };
