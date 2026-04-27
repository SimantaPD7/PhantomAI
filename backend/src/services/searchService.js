import { logger } from '../utils/logger.js';

class SearchService {
  constructor() {
    this.apiKey = process.env.TAVILY_API_KEY;
    this.baseURL = 'https://api.tavily.com';
  }

  async search(query, options = {}) {
    if (!this.apiKey || this.apiKey.startsWith('tvly-xxx')) {
      logger.warn('Tavily API key not configured — search disabled');
      return { results: [], error: 'Search service not configured' };
    }

    // Use AbortController for timeout (node-fetch v3 / native fetch compatible)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const payload = {
        api_key: this.apiKey,
        query,
        search_depth: options.depth || 'basic',
        include_answer: options.includeAnswer !== false,
        include_raw_content: options.includeRaw || false,
        max_results: options.maxResults || 5,
        include_domains: options.includeDomains || [],
        exclude_domains: options.excludeDomains || [],
      };

      const response = await fetch(`${this.baseURL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        answer: data.answer || '',
        results: data.results?.map(r => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
          publishedDate: r.published_date,
        })) || [],
        query,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        logger.error('Search timed out after 10s');
        return { results: [], error: 'Search timed out', query };
      }
      logger.error('Search error:', error);
      return { results: [], error: error.message, query };
    }
  }

  isRealTimeQuery(content) {
    const realTimePatterns = [
      // Time-sensitive language
      /latest|recent|current|today|now|live|breaking|upcoming|new release/i,
      /\d{4}\s*(news|update|release|model|version)/i,
      /what('s| is) happening/i,

      // Prices and availability
      /price|cost|how much|msrp|retail|buy|purchase|order|available/i,
      /\$\d+|\d+\s*dollar|\d+\s*usd|\d+\s*inr|\d+\s*rupee/i,

      // Product / tech releases
      /iphone\s*\d+|ipad\s*\d+|macbook|airpods|apple\s*(watch|vision)/i,
      /samsung\s*(galaxy|s\d+)|pixel\s*\d+|oneplus\s*\d+/i,
      /rtx\s*\d+|rx\s*\d+|nvidia|amd\s*(gpu|card)/i,
      /playstation\s*\d+|xbox\s*series|nintendo\s*switch/i,
      /gpt-\d+|claude\s*\d+|gemini\s*\d+|llm|ai\s*model/i,
      /release\s*date|launch\s*date|announced|leaked/i,
      /specs|specification|benchmark|review/i,

      // News and events
      /stock price|weather|sports score|match result|election/i,
      /who (is|are) (the|currently)|who won|who leads/i,
      /news about|update on|status of/i,

      // Geopolitics, conflicts, world events
      /war|conflict|attack|strike|invasion|ceasefire|missile|bomb|troops|military/i,
      /iran|israel|ukraine|russia|gaza|palestine|nato|china|taiwan|north korea/i,
      /sanctions|treaty|summit|protest|coup|president|prime minister/i,
      /earthquake|flood|hurricane|disaster|crisis|outbreak|pandemic/i,

      // Comparison with recency signal
      /best\s*(phone|laptop|gpu|tv|headphone|camera)\s*(right now|in \d{4}|currently|today)/i,
    ];
    return realTimePatterns.some(p => p.test(content));
  }

  formatResultsForContext(searchResult) {
    if (!searchResult.results?.length) return '';

    let context = `## Real-Time Search Results for: "${searchResult.query}"\n\n`;

    if (searchResult.answer) {
      context += `**Quick Answer:** ${searchResult.answer}\n\n`;
    }

    context += '**Sources:**\n';
    searchResult.results.slice(0, 5).forEach((r, i) => {
      context += `\n### ${i + 1}. ${r.title}\n`;
      context += `URL: ${r.url}\n`;
      context += `${r.content?.slice(0, 500)}...\n`;
    });

    return context;
  }
}

export const searchService = new SearchService();
