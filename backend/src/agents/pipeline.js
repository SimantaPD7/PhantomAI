import { aiService, PHANTOM_SYSTEM_PROMPT } from '../services/aiService.js';
import { searchService } from '../services/searchService.js';
import { memoryService } from '../services/memoryService.js';
import { ragService } from '../services/ragService.js';
import { logger } from '../utils/logger.js';

// ─── PLANNER AGENT ───────────────────────────────────────────────────────────

async function plannerAgent(userMessage, conversationHistory, memoryContext) {
  const systemPrompt = `You are the Planner Agent in PhantomAI's multi-agent system.
Your role: Analyze the user's intent and create a structured execution plan.
${memoryContext ? `\nUser context from memory:\n${memoryContext}` : ''}

IMPORTANT: Set "requiresSearch": true for ANY question about facts, events, people, products,
science, history, technology, health, or the world. Only set it false for pure coding tasks
(writing/debugging code) or pure math/logic with no factual component.

Output ONLY a JSON object (no markdown, no extra text) with this exact structure:
{
  "intent": "brief description of what user wants",
  "taskType": "coding|reasoning|research|casual|planning|formatting",
  "requiresSearch": true/false,
  "requiresRAG": true/false,
  "steps": ["step1", "step2"],
  "complexity": "simple|medium|complex",
  "searchQuery": "optimized search query if requiresSearch is true, else null"
}`;

  try {
    const { response } = await aiService.complete({
      messages: [
        ...conversationHistory.slice(-4),
        { role: 'user', content: userMessage },
      ],
      systemPrompt,
      taskType: 'planning',
      temperature: 0.2,
      maxTokens: 400,
    });

    const text = response.choices[0].message.content;
    const jsonText = text.replace(/```(?:json)?\n?|\n?```/g, '').trim();
    return JSON.parse(jsonText);
  } catch (error) {
    logger.error('Planner agent error:', error.message);
    return {
      intent: 'answer user question',
      taskType: aiService.detectTaskType(userMessage),
      requiresSearch: searchService.isRealTimeQuery(userMessage),
      requiresRAG: false,
      steps: ['Generate response'],
      complexity: 'simple',
      searchQuery: userMessage,
    };
  }
}

// ─── RESEARCH AGENT ──────────────────────────────────────────────────────────

async function researchAgent(plan, sessionId, userMessage, onResearchDone) {
  const research = {
    searchResults: null,
    ragResults: null,
    context: '',
    searchUsed: false,
    ragUsed: false,
    ragChunks: 0,
    resultCount: 0,
  };

  // 1. Real-time web search
  if (plan.requiresSearch) {
    logger.debug('Research Agent: Running Tavily search for:', plan.searchQuery);
    const searchQuery = plan.searchQuery || plan.intent || userMessage;
    research.searchResults = await searchService.search(searchQuery, {
      depth: plan.complexity === 'complex' ? 'advanced' : 'basic',
      maxResults: 5,
    });
    if (research.searchResults?.results?.length > 0) {
      research.searchUsed = true;
      research.resultCount = research.searchResults.results.length;
      research.context += searchService.formatResultsForContext(research.searchResults);
      logger.debug(`Research Agent: Got ${research.resultCount} search results`);
    }
  }

  // 2. RAG retrieval — only if session has documents AND plan requires it
  if (plan.requiresRAG !== false) {
    const namespace = ragService.getSessionNamespace(sessionId);
    const ragResults = await ragService.retrieve(namespace, userMessage, 5);
    if (ragResults.length > 0) {
      research.ragResults = ragResults;
      research.ragUsed = true;
      research.ragChunks = ragResults.length;
      const ragContext = ragService.buildRAGContext(ragResults, userMessage);
      research.context += (research.context ? '\n\n' : '') + ragContext;
      logger.debug(`Research Agent: Retrieved ${ragResults.length} RAG chunks from namespace ${namespace}`);
    }
  }

  // Fire callback so SSE can notify frontend
  if (onResearchDone) {
    onResearchDone({
      searchUsed: research.searchUsed,
      ragUsed: research.ragUsed,
      resultCount: research.resultCount,
      chunkCount: research.ragChunks,
    });
  }

  return research;
}

// ─── REASONING AGENT — streams tokens one by one ─────────────────────────────

// Detect script/language of user message for per-request injection
// ─── UNIVERSAL LANGUAGE DETECTOR ─────────────────────────────────────────────
function detectLanguageHint(msg) {
  const t = msg.trim();

  // ── Script-based detection via Unicode ranges ──────────────────────────────

  if (/[\u0900-\u097F]/.test(t))
    return 'User wrote in Devanagari script (Hindi/Marathi/Nepali/Sanskrit). Reply in the same language and script.';

  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDCF\uFE70-\uFEFF]/.test(t))
    return 'User wrote in Arabic script (Arabic/Urdu/Persian/Pashto/Sindhi/Uyghur etc.). Identify which language and reply in it.';

  if (/[\u0980-\u09FF]/.test(t)) return 'User wrote in Bengali. Reply in Bengali.';
  if (/[\u0A00-\u0A7F]/.test(t)) return 'User wrote in Punjabi (Gurmukhi). Reply in Punjabi.';
  if (/[\u0A80-\u0AFF]/.test(t)) return 'User wrote in Gujarati. Reply in Gujarati.';
  if (/[\u0B00-\u0B7F]/.test(t)) return 'User wrote in Odia. Reply in Odia.';
  if (/[\u0B80-\u0BFF]/.test(t)) return 'User wrote in Tamil. Reply in Tamil.';
  if (/[\u0C00-\u0C7F]/.test(t)) return 'User wrote in Telugu. Reply in Telugu.';
  if (/[\u0C80-\u0CFF]/.test(t)) return 'User wrote in Kannada. Reply in Kannada.';
  if (/[\u0D00-\u0D7F]/.test(t)) return 'User wrote in Malayalam. Reply in Malayalam.';
  if (/[\u0D80-\u0DFF]/.test(t)) return 'User wrote in Sinhala. Reply in Sinhala.';
  if (/[\u0E00-\u0E7F]/.test(t)) return 'User wrote in Thai. Reply in Thai.';
  if (/[\u0E80-\u0EFF]/.test(t)) return 'User wrote in Lao. Reply in Lao.';
  if (/[\u0F00-\u0FFF]/.test(t)) return 'User wrote in Tibetan. Reply in Tibetan.';
  if (/[\u1000-\u109F]/.test(t)) return 'User wrote in Burmese/Myanmar. Reply in Burmese.';
  if (/[\u10A0-\u10FF]/.test(t)) return 'User wrote in Georgian. Reply in Georgian.';
  if (/[\u0530-\u058F]/.test(t)) return 'User wrote in Armenian. Reply in Armenian.';
  if (/[\u1200-\u137F]/.test(t)) return 'User wrote in Ethiopic script (Amharic/Tigrinya etc.). Reply in the same language.';
  if (/[\u1780-\u17FF]/.test(t)) return 'User wrote in Khmer. Reply in Khmer.';
  if (/[\u1800-\u18AF]/.test(t)) return 'User wrote in Mongolian. Reply in Mongolian.';
  if (/[\u0590-\u05FF\uFB1D-\uFB4F]/.test(t)) return 'User wrote in Hebrew. Reply in Hebrew.';

  // Korean Hangul
  if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(t))
    return 'User wrote in Korean. Reply in Korean.';

  // Japanese (Hiragana/Katakana — with or without Kanji)
  if (/[\u3040-\u30FF]/.test(t))
    return 'User wrote in Japanese. Reply in Japanese.';

  // Chinese (CJK without Japanese kana)
  if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(t))
    return 'User wrote in Chinese. Reply in Chinese (match Simplified or Traditional based on context).';

  // Cyrillic — detect sub-language by unique letters
  if (/[\u0400-\u04FF]/.test(t)) {
    if (/[\u0406\u0456\u0407\u0457\u0490\u0491\u04BA\u04BB]/.test(t))
      return 'User wrote in Ukrainian. Reply in Ukrainian.';
    if (/[\u0452\u0453\u0455\u0458\u0459\u045A\u045B\u045C\u045E]/.test(t))
      return 'User wrote in Serbian/Macedonian/Bosnian. Reply in the same language.';
    if (/[\u0492\u0493\u04A2\u04A3\u04AE\u04AF\u04B0\u04B1\u04B2\u04B3]/.test(t))
      return 'User wrote in Kazakh/Uzbek/Kyrgyz. Reply in the same language.';
    return 'User wrote in Cyrillic script (Russian/Bulgarian/Belarusian etc.). Identify the language and reply in it.';
  }

  // Greek
  if (/[\u0370-\u03FF\u1F00-\u1FFF]/.test(t))
    return 'User wrote in Greek. Reply in Greek.';

  // ── Latin-script language fingerprints ────────────────────────────────────

  // Hinglish (Hindi romanised in Latin)
  if (/\b(hai|hain|kya|nahi|nah|haan|bhai|yaar|kar|rha|rhi|rhe|ho|tha|thi|the|aur|mera|tera|uska|kaise|kyun|kab|kahan|mat|bas|bol|bata|accha|acha|theek|thik|abhi|pehle|bahut|bohot|zyada|thoda|sab|kuch|aaj|kal|phir|woh|yeh|tum|hum|main|mujhe|tumhe|usse|unhe|dost|yaar|mast|bolo|suno|dekh|sun|chal|hlo|helo|re bhai|oye|abe|arre)\b/i.test(t))
    return 'User is writing in Hinglish (Hindi romanised). Reply in Hinglish — warm and casual like a friend texting.';

  // Urdu romanised
  if (/\b(aap|ap|hai|hain|nahi|haan|karo|kiya|karna|achha|theek|bohat|bahut|phir|abhi|kal|aaj|zindagi|dil|pyar|mohabbat|shukriya|khuda|allah|inshallah|mashallah|yaar|dost)\b/i.test(t))
    return 'User is writing in Roman Urdu. Reply in Roman Urdu.';

  // Spanish
  if (/\b(que|qué|es|una|los|las|con|por|para|pero|como|hola|gracias|sí|estoy|está|tiene|tengo|hacer|quiero|puedo|cuando|donde|porque|también|siempre|nunca|ahora|aquí|algo|todo|mucho|poco|nada|alguien|nadie|otro|tiempo|vida|mundo|gente|año|día|vez|lugar)\b/i.test(t))
    return 'User wrote in Spanish. Reply in Spanish.';

  // French
  if (/\b(je|tu|il|elle|nous|vous|ils|sont|ont|avec|pour|dans|sur|par|pas|plus|les|des|une|que|qui|ce|se|leur|tout|bien|très|aussi|mais|donc|bonjour|merci|voilà|être|avoir|faire|aller|pouvoir|vouloir|savoir|voir|venir|prendre|dire)\b/i.test(t))
    return 'User wrote in French. Reply in French.';

  // Portuguese
  if (/\b(que|é|um|uma|com|não|sim|bom|bem|muito|estou|está|tem|tenho|fazer|quero|posso|quando|onde|porque|também|sempre|nunca|aqui|ali|algo|tudo|mais|menos|pouco|nada|alguém|cada|outro|mesmo|grande|obrigado|olá|oi|tudo bem|favor)\b/i.test(t))
    return 'User wrote in Portuguese. Reply in Portuguese.';

  // German
  if (/\b(ich|du|er|sie|wir|ihr|ist|sind|hat|haben|mit|für|auf|an|bei|von|ein|eine|der|die|das|und|oder|aber|nicht|ja|nein|gut|sehr|auch|noch|schon|hier|wie|was|wo|wer|wann|warum|dann|wenn|dass|als|ob|weil|denn|also|hallo|danke|bitte)\b/i.test(t))
    return 'User wrote in German. Reply in German.';

  // Italian
  if (/\b(io|tu|lui|lei|noi|voi|loro|è|sono|con|per|su|da|un|una|il|lo|la|gli|le|e|o|ma|non|sì|bene|molto|anche|ancora|già|come|cosa|dove|chi|quando|perché|questo|quello|grande|piccolo|tempo|vita|grazie|ciao|prego|buongiorno)\b/i.test(t))
    return 'User wrote in Italian. Reply in Italian.';

  // Dutch
  if (/\b(ik|jij|hij|zij|wij|jullie|is|zijn|heeft|hebben|met|voor|in|op|aan|bij|van|te|een|de|het|en|of|maar|niet|ja|nee|goed|ook|nog|al|hier|hoe|wat|waar|wie|wanneer|waarom|als|dat|dan|want|dus|hallo|dank|alsjeblieft)\b/i.test(t))
    return 'User wrote in Dutch. Reply in Dutch.';

  // Swahili
  if (/\b(na|ya|wa|ni|si|kwa|za|la|pia|sana|ndiyo|hapana|asante|habari|karibu|pole|rafiki|mzuri|mbaya|sawa|kwaheri|samahani|tafadhali|nini|wapi|lini|jinsi|gani)\b/i.test(t))
    return 'User wrote in Swahili. Reply in Swahili.';

  // Indonesian / Malay
  if (/\b(aku|saya|kamu|anda|dia|kami|kita|mereka|adalah|ada|dengan|untuk|dalam|pada|dari|yang|dan|atau|tapi|tidak|ya|baik|sangat|juga|sudah|belum|sini|sana|bagaimana|apa|mana|siapa|kapan|mengapa|kalau|halo|terima kasih|tolong|maaf)\b/i.test(t))
    return 'User wrote in Indonesian/Malay. Reply in Indonesian/Malay.';

  // Turkish
  if (/\b(ben|sen|bir|ve|veya|ama|değil|evet|hayır|iyi|çok|ile|için|gibi|nasıl|ne|nerede|kim|neden|eğer|merhaba|teşekkür|lütfen|tamam|bu|şu|o|biz|siz)\b/i.test(t))
    return 'User wrote in Turkish. Reply in Turkish.';

  // Vietnamese
  if (/\b(tôi|bạn|anh|chị|em|họ|với|cho|trong|trên|từ|và|hoặc|nhưng|không|vâng|tốt|rất|cũng|đây|đó|gì|đâu|ai|khi|tại|xin chào|cảm ơn|xin lỗi)\b/i.test(t))
    return 'User wrote in Vietnamese. Reply in Vietnamese.';

  // Tagalog / Filipino
  if (/\b(ako|ikaw|siya|kami|kayo|sila|ang|ng|sa|na|at|pero|hindi|oo|salamat|kamusta|paano|ano|saan|sino|kailan|bakit|kung|po|opo|naman|dito|doon|talaga|kasi)\b/i.test(t))
    return 'User wrote in Tagalog/Filipino. Reply in Tagalog/Filipino.';

  // Polish
  if (/\b(ja|ty|on|ona|my|wy|oni|jest|są|ma|mam|z|dla|w|na|przy|od|do|i|lub|ale|nie|tak|nie|dobrze|też|już|tu|jak|co|gdzie|kto|kiedy|dlaczego|jeśli|że|hej|dziękuję|proszę|przepraszam)\b/i.test(t))
    return 'User wrote in Polish. Reply in Polish.';

  // Swedish / Norwegian / Danish (Nordic)
  if (/\b(jag|du|han|hon|vi|de|är|har|med|för|i|på|av|en|ett|och|eller|men|inte|ja|nej|bra|också|redan|här|hur|vad|var|vem|när|varför|om|hej|tack|snälla|ursäkta)\b/i.test(t))
    return 'User wrote in a Nordic language (Swedish/Norwegian/Danish). Reply in the same language.';

  // Finnish
  if (/\b(minä|sinä|hän|me|te|he|on|ovat|kanssa|varten|siinä|kyllä|ei|hyvä|myös|täällä|kuinka|mitä|missä|kuka|milloin|miksi|jos|moi|kiitos|ole hyvä|anteeksi)\b/i.test(t))
    return 'User wrote in Finnish. Reply in Finnish.';

  // Romanian
  if (/\b(eu|tu|el|ea|noi|voi|ei|ele|este|sunt|cu|pentru|în|pe|de|un|o|și|sau|dar|nu|da|bine|și|deja|aici|cum|ce|unde|cine|când|de ce|dacă|că|bună|mulțumesc|vă rog|scuze)\b/i.test(t))
    return 'User wrote in Romanian. Reply in Romanian.';

  // No specific language detected — model will use its own built-in detection
  return null;
}

async function reasoningAgent({
  userMessage,
  plan,
  research,
  conversationHistory,
  memoryContext,
  longTermMemory,
  onChunk,
}) {
  // Build enriched system prompt
  let systemPrompt = PHANTOM_SYSTEM_PROMPT;

  // ── Inject per-message language directive (highest priority) ──
  const langHint = detectLanguageHint(userMessage);
  if (langHint) {
    systemPrompt = `LANGUAGE DIRECTIVE (override everything): ${langHint}

` + systemPrompt;
  }

  // ── Inject memory context (long-term preferences + semantic) ──
  if (memoryContext) {
    systemPrompt += `\n\n${memoryContext}`;
  }

  // ── Inject structured long-term facts ──
  if (longTermMemory?.preferences && Object.keys(longTermMemory.preferences).length > 0) {
    systemPrompt += `\n\n## User Preferences (from long-term memory)\n`;
    for (const [k, v] of Object.entries(longTermMemory.preferences)) {
      systemPrompt += `- ${k}: ${v}\n`;
    }
  }
  if (longTermMemory?.facts?.length > 0) {
    systemPrompt += `\n## Known Facts About User\n`;
    longTermMemory.facts.forEach(f => { systemPrompt += `- ${f}\n`; });
  }

  // ── Inject RAG context (document excerpts) ──
  if (research.ragUsed && research.context) {
    systemPrompt += `\n\n${research.context}`;
    systemPrompt += `\n\n**IMPORTANT:** You have access to the user's uploaded documents above. Use them directly to answer. Quote relevant passages and cite them.`;
    logger.debug(`Reasoning Agent: RAG context injected (${research.ragChunks} chunks)`);
  }

  // ── Inject web search results ──
  if (research.searchUsed && research.context) {
    if (!research.ragUsed) systemPrompt += `\n\n${research.context}`;
    systemPrompt += `\n\n**IMPORTANT:** Use the real-time search results above to provide current, accurate information. Do not rely solely on training data. Do NOT include inline citation numbers like [1], [2], [3] anywhere in your response — sources are listed separately.`;
    logger.debug(`Reasoning Agent: Search context injected (${research.resultCount} results)`);
  }

  // ── Task-specific instructions ──
  if (plan.taskType === 'coding') {
    systemPrompt += '\n\n## Code Task\nProvide complete, runnable code with inline comments. Include usage examples. Always specify language in code blocks.';
  } else if (plan.taskType === 'reasoning') {
    systemPrompt += '\n\n## Reasoning Task\nThink step-by-step. State your assumptions. Identify counterarguments. Conclude with a clear verdict.';
  } else if (plan.complexity === 'complex') {
    systemPrompt += '\n\n## Complex Request\nStructure with headers (##). Provide comprehensive, thorough coverage. Use tables and lists where they aid clarity.';
  }

  const maxTokens =
    plan.taskType === 'casual' ? 300 :
    plan.complexity === 'complex' ? 4000 :
    plan.complexity === 'medium' ? 2500 : 1200;

  logger.debug(`Reasoning Agent: model=${aiService.getModelForTask(plan.taskType)}, maxTokens=${maxTokens}`);

  const result = await aiService.streamComplete({
    messages: [
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ],
    systemPrompt,
    taskType: plan.taskType,
    temperature: plan.taskType === 'coding' ? 0.2 : 0.7,
    maxTokens,
    onChunk,
  });

  return result;
}

// ─── FORMATTER AGENT ─────────────────────────────────────────────────────────

async function formatterAgent(rawContent, plan, research) {
  let formatted = rawContent;

  // Strip inline citation/reference numbers like [1], [2][3], [1][3][5] etc.
  // These leak in from web search context injected into the model's prompt
  formatted = formatted.replace(/(\[\d+\])+/g, '');

  // Clean up any double spaces left behind after stripping
  formatted = formatted.replace(/  +/g, ' ').trim();

  // Append clean source links (no numbers — just titled links)
  if (research.searchUsed && research.searchResults?.results?.length > 0) {
    formatted += '\n\n---\n**Sources**\n';
    research.searchResults.results.slice(0, 4).forEach((r, i) => {
      formatted += `${i + 1}. [${r.title}](${r.url})\n`;
    });
  }

  return formatted;
}

// ─── CASUAL FAST-PATH DETECTOR ───────────────────────────────────────────────
// Detects greetings / small-talk in ANY language so we skip the planner entirely

function isCasualMessage(msg) {
  const t = msg.trim();

  // If message has ANY research/information intent — never treat as casual
  const notCasual = /https?:|```|error|debug|\bfunction\b|\bclass\b|\bapi\b|\bcode\b|algorithm|explain|what is|what are|how does|how do|how to|why does|why is|difference between|compare|analyze|summarize|write a|create a|build|implement|tell me about|\bsearch\b|\bfind\b|latest|\bprice\b|\bcost\b|\bnews\b|update|\bcurrent\b|today|yesterday|when did|when was|who is|who was|who won|\bbest\b|recommend|should i|can you|please|help me|kya hota|kya hai|kaise karte|samjhao|price kya|kitna|kitne|kaisa hoga|kab hoga|kahan hai|iphone|samsung|pixel|macbook|airpods|ipad|oneplus|galaxy|rtx|nvidia|amd|specs|release|launch|review|benchmark|buy|purchase|order|\$\d+|\d+\s*dollar|\d+\s*usd|\d+\s*inr|rupee|war|conflict|attack|strike|invasion|ceasefire|missile|bomb|troops|military|iran|israel|ukraine|russia|gaza|palestine|nato|china|taiwan|earthquake|flood|hurricane|disaster|crisis|outbreak|election|president|prime minister|sanctions|protest|coup/i;
  if (notCasual.test(t)) return false;

  // Must match a positive casual pattern to skip research
  const casualPatterns = [
    /^(hi|hey|hlo|helo|hello|sup|yo|hola|namaste|namaskar|salut|ciao|oi|hei|merhaba|salam|assalam|adaab|howdy)\b/i,
    /^(how are you|how r u|kaise ho|kya haal|kaisa hai|kaisi ho|wassup|sab theek|sab badhiya|all good)\b/i,
    /^(thanks|thank you|shukriya|dhanyawad|merci|gracias|danke|arigato|shukran|thx|ty)\b/i,
    /^(bye|goodbye|tc|take care|alvida|phir milenge|cya|see you)\b/i,
    /^(ok|okay|sure|yep|haan|bilkul|theek hai|accha|acha|thik hai|done|got it|samjha|samjhi|hmm|ohh|ohk|ahan)\b/i,
    /^(good|great|nice|cool|awesome|amazing|wow|wah|mast|zabardast|sahi hai|ekdum|perfect|superb)\b/i,
    /^(kya kar rha|kya kar rahi|kya ho rha|chal kya raha|bored hun|thak gaya|thak gayi)\b/i,
    /^(bhai|yaar|dost|arre bhai|oye yaar|re bhai|abe yaar)\s*[!.]*$/i,
    /^(lol|haha|hehe)\b/i,
  ];
  return casualPatterns.some(p => p.test(t));
}


// ─── MASTER PIPELINE ─────────────────────────────────────────────────────────

export async function runAgentPipeline({
  userMessage,
  conversationHistory = [],
  sessionId,
  userId,
  onChunk,
  onPlanReady,
  onResearchDone,
}) {
  const startTime = Date.now();

  // ── STEP 1: Build memory context (all 3 layers) ──
  logger.debug('Pipeline: Building memory context…');
  const memoryContexts = await memoryService.buildMemoryContext(sessionId, userId, userMessage);
  const memoryContextStr = memoryService.formatMemoryContextForPrompt(memoryContexts);

  // Also get raw long-term memory for structured injection
  let longTermMemory = null;
  if (userId) {
    const ltRaw = await memoryService.getLongTerm(userId);
    if (ltRaw.length > 0) {
      longTermMemory = ltRaw.reduce((acc, m) => {
        acc.preferences = { ...acc.preferences, ...(m.preferences || {}) };
        acc.facts = [...(acc.facts || []), ...(m.facts || [])];
        return acc;
      }, { preferences: {}, facts: [] });
    }
  }

  const memoryUsed = !!(memoryContextStr || longTermMemory);
  logger.debug(`Pipeline: Memory context ready. longTerm=${!!longTermMemory}, semantic=${memoryContextStr.length > 0}`);

  // ── STEP 2: Planner (skipped for casual messages) ──
  let plan;
  if (isCasualMessage(userMessage)) {
    logger.debug('Pipeline: Casual message detected — skipping planner & research');
    plan = {
      intent: 'casual conversation',
      taskType: 'casual',
      requiresSearch: false,
      requiresRAG: false,
      steps: ['Respond naturally'],
      complexity: 'simple',
      searchQuery: null,
    };
    if (onPlanReady) onPlanReady(plan);
    // Fire onResearchDone immediately so the SSE stage advances
    if (onResearchDone) onResearchDone({ searchUsed: false, ragUsed: false, resultCount: 0, chunkCount: 0 });
  } else {
    logger.debug('Pipeline: Running planner agent…');
    plan = await plannerAgent(userMessage, conversationHistory, memoryContextStr);

    // ── Universal search rule: if the user is asking ANYTHING that isn't
    //    pure coding/math/logic — search. We never want to answer factual,
    //    world-knowledge, or current-events questions from training data alone.
    //    Only skip search for taskTypes where external data adds zero value.
    const searchExemptTypes = new Set(['coding', 'formatting']);
    const isPureLogic = searchExemptTypes.has(plan.taskType) &&
      !/price|cost|release|latest|news|war|conflict|who|when|where|what happened|current|today|update/i.test(userMessage);

    if (!isPureLogic) {
      if (!plan.requiresSearch) {
        logger.info(`Pipeline: Forcing search ON for taskType=${plan.taskType} — universal search rule`);
      }
      plan.requiresSearch = true;
      if (!plan.searchQuery) plan.searchQuery = userMessage;
    }

    logger.info(`Plan: taskType=${plan.taskType}, complexity=${plan.complexity}, search=${plan.requiresSearch}, rag=${plan.requiresRAG}`);
    if (onPlanReady) onPlanReady(plan);
  }

  // ── STEP 3: Research (search + RAG) — skipped for casual messages ──
  let research;
  if (plan.taskType === 'casual') {
    logger.debug('Pipeline: Skipping research for casual message');
    research = { searchResults: null, ragResults: null, context: '', searchUsed: false, ragUsed: false, ragChunks: 0, resultCount: 0 };
  } else {
    logger.debug('Pipeline: Running research agent…');
    research = await researchAgent(plan, sessionId, userMessage, onResearchDone);
  }

  // ── STEP 4: Reasoning (streaming) ──
  logger.debug('Pipeline: Running reasoning agent (streaming)…');
  let fullContent = '';

  const { content, model } = await reasoningAgent({
    userMessage,
    plan,
    research,
    conversationHistory,
    memoryContext: memoryContextStr,
    longTermMemory,
    onChunk: (chunk) => {
      fullContent += chunk;
      if (onChunk) onChunk(chunk);
    },
  });

  // ── STEP 5: Formatter ──
  const formattedContent = await formatterAgent(content, plan, research);

  // ── STEP 6: Update all memory layers async ──
  setImmediate(async () => {
    try {
      // Short-term
      memoryService.addToShortTerm(sessionId, { role: 'user', content: userMessage });
      memoryService.addToShortTerm(sessionId, { role: 'assistant', content: content });

      if (userId) {
        // Semantic memory — embed user message for future retrieval
        await memoryService.addSemanticMemory(userId, userMessage, {
          sessionId,
          taskType: plan.taskType,
          responseSnippet: content.slice(0, 200),
        });

        // Extract and persist preferences/facts from conversation
        await memoryService.extractAndPersistInsights(userId, sessionId, userMessage, content);
      }
    } catch (err) {
      logger.error('Memory update error:', err);
    }
  });

  const elapsed = Date.now() - startTime;
  logger.info(`Pipeline done in ${elapsed}ms — model=${model}, ragChunks=${research.ragChunks}, searchResults=${research.resultCount}`);

  return {
    content: formattedContent,
    model,
    taskType: plan.taskType,
    usedSearch: research.searchUsed,
    usedRAG: research.ragUsed,
    ragChunks: research.ragChunks,
    plan,
    elapsed,
    memoryUsed,
  };
}