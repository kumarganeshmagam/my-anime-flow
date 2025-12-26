import { firestoreHelpers, type AnimeData, type GeneratedContent, Timestamp } from '../config/firebase'

export interface ReelScript {
  hook: string
  setup: string
  mainContent: string
  callToAction: string
  fullScript: string
  hashtags: string[]
  estimatedDuration: string
}

export interface CarouselSlide {
  slideNumber: number
  content: string
  visualDescription: string
}

export interface GeneratedPost {
  caption: string
  hashtags: string[]
  imagePrompt: string
  platform: 'instagram' | 'youtube' | 'tiktok' | 'all'
}

export class AIContentGenerator {
  private apiKey: string | null = null
  private model = 'claude-sonnet-4-20250514'
  private apiUrl = 'https://api.anthropic.com/v1/messages'

  constructor() {
    this.apiKey = localStorage.getItem('anthropic_api_key')
  }

  // Check if API is configured
  isConfigured(): boolean {
    return !!this.apiKey
  }

  // Update API key
  setApiKey(key: string): void {
    this.apiKey = key
    localStorage.setItem('anthropic_api_key', key)
  }

  // Make API request to Claude
  private async callClaudeAPI(prompt: string, maxTokens: number = 1500): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured. Please add it in Settings.')
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`API Error: ${response.status} - ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    return data.content[0].text
  }

  // Generate Instagram Reel script
  async generateReelScript(anime: AnimeData): Promise<ReelScript> {
    const prompt = `Create a viral Instagram Reel script for the anime "${anime.title}" Episode ${anime.episode}.

Context:
- Genre: ${anime.genre}
- Air Time: ${anime.time} JST on ${anime.day}
- ${anime.trending ? 'This anime is TRENDING right now - emphasize the hype!' : 'This is a great anime to introduce to new viewers.'}

Requirements:
- Total duration: 30 seconds maximum
- Start with an attention-grabbing hook (first 3 seconds)
- Use trendy 2025 social media style and language
- Include relevant emojis
- Make it engaging and shareable
- Include a clear call-to-action

Please format your response EXACTLY as follows:

[HOOK (0-3 seconds)]
<write the hook here>

[SETUP (3-10 seconds)]
<write the setup here>

[MAIN CONTENT (10-25 seconds)]
<write the main content here>

[CALL TO ACTION (25-30 seconds)]
<write the CTA here>

[HASHTAGS]
<list 15-20 relevant hashtags starting with #>`

    const response = await this.callClaudeAPI(prompt)
    return this.parseReelScript(response)
  }

  // Parse reel script response
  private parseReelScript(response: string): ReelScript {
    const hookMatch = response.match(/\[HOOK.*?\]\s*([\s\S]*?)(?=\[SETUP|$)/i)
    const setupMatch = response.match(/\[SETUP.*?\]\s*([\s\S]*?)(?=\[MAIN|$)/i)
    const mainMatch = response.match(/\[MAIN.*?\]\s*([\s\S]*?)(?=\[CALL|$)/i)
    const ctaMatch = response.match(/\[CALL.*?\]\s*([\s\S]*?)(?=\[HASHTAGS|$)/i)
    const hashtagsMatch = response.match(/\[HASHTAGS\]\s*([\s\S]*?)$/i)

    const hashtags = hashtagsMatch
      ? hashtagsMatch[1].match(/#\w+/g) || []
      : ['#anime', '#animereels', '#weeb']

    return {
      hook: hookMatch?.[1]?.trim() || '',
      setup: setupMatch?.[1]?.trim() || '',
      mainContent: mainMatch?.[1]?.trim() || '',
      callToAction: ctaMatch?.[1]?.trim() || '',
      fullScript: response,
      hashtags,
      estimatedDuration: '30 seconds'
    }
  }

  // Generate Midjourney/DALL-E image prompt
  async generateImagePrompt(anime: AnimeData): Promise<string> {
    const prompt = `Create a detailed AI image generation prompt (for Midjourney or DALL-E) for an Instagram post about the anime "${anime.title}".

Context:
- Genre: ${anime.genre}
- ${anime.trending ? 'This is a trending anime' : 'Standard anime post'}

Requirements:
- Eye-catching, vibrant colors appropriate for the genre
- Anime art style
- Should work as an Instagram post (1080x1080 square format)
- Include atmospheric lighting
- Trendy 2025 aesthetics
- Should convey the mood and genre of the anime

Generate ONLY the image prompt, no explanations or additional text. Start directly with the prompt.`

    const response = await this.callClaudeAPI(prompt, 500)
    return response.trim()
  }

  // Generate weekly schedule carousel post
  async generateWeeklyCarousel(animeList: AnimeData[]): Promise<CarouselSlide[]> {
    const animeSchedule = animeList
      .map(a => `- ${a.title}: ${a.day} at ${a.time} JST, Episode ${a.episode}${a.trending ? ' (TRENDING)' : ''}`)
      .join('\n')

    const prompt = `Create an Instagram carousel post (10 slides) for this week's anime schedule:

${animeSchedule}

Requirements:
- Slide 1: Eye-catching intro slide with "Weekly Anime Schedule" theme
- Slides 2-9: Feature anime (group by day or highlight top picks)
- Slide 10: "Follow for more!" CTA slide
- Use emojis heavily
- Trendy 2025 social media style
- Each slide should be concise (fit on a single carousel slide)

Format each slide as:
[SLIDE 1]
Content: <what text appears on the slide>
Visual: <brief description of the slide visual/design>

Continue for all 10 slides.`

    const response = await this.callClaudeAPI(prompt, 2000)
    return this.parseCarouselSlides(response)
  }

  // Parse carousel slides
  private parseCarouselSlides(response: string): CarouselSlide[] {
    const slides: CarouselSlide[] = []
    const slideMatches = response.matchAll(/\[SLIDE (\d+)\]\s*Content:\s*([\s\S]*?)Visual:\s*([\s\S]*?)(?=\[SLIDE|\s*$)/gi)

    for (const match of slideMatches) {
      slides.push({
        slideNumber: parseInt(match[1]),
        content: match[2].trim(),
        visualDescription: match[3].trim()
      })
    }

    // If parsing failed, create default slides
    if (slides.length === 0) {
      return [{
        slideNumber: 1,
        content: response.slice(0, 500),
        visualDescription: 'Anime schedule post'
      }]
    }

    return slides
  }

  // Generate simple post caption
  async generatePostCaption(anime: AnimeData): Promise<GeneratedPost> {
    const prompt = `Create an Instagram post caption for the anime "${anime.title}" Episode ${anime.episode}.

Context:
- Genre: ${anime.genre}
- Air Time: ${anime.time} JST on ${anime.day}
- ${anime.trending ? 'TRENDING anime' : 'Regular anime post'}

Requirements:
- Engaging caption (2-4 sentences)
- Include relevant emojis
- Create FOMO/excitement
- End with a question to boost engagement

Format your response as:
CAPTION:
<your caption here>

HASHTAGS:
<list 20-25 hashtags>

IMAGE_PROMPT:
<brief Midjourney prompt for a post image>`

    const response = await this.callClaudeAPI(prompt, 800)

    const captionMatch = response.match(/CAPTION:\s*([\s\S]*?)(?=HASHTAGS:|$)/i)
    const hashtagsMatch = response.match(/HASHTAGS:\s*([\s\S]*?)(?=IMAGE_PROMPT:|$)/i)
    const imagePromptMatch = response.match(/IMAGE_PROMPT:\s*([\s\S]*?)$/i)

    return {
      caption: captionMatch?.[1]?.trim() || '',
      hashtags: hashtagsMatch?.[1]?.match(/#\w+/g) || [],
      imagePrompt: imagePromptMatch?.[1]?.trim() || '',
      platform: 'instagram'
    }
  }

  // Generate YouTube Short script
  async generateYouTubeShort(anime: AnimeData): Promise<ReelScript> {
    const prompt = `Create a YouTube Shorts script for the anime "${anime.title}" Episode ${anime.episode}.

Context:
- Genre: ${anime.genre}
- ${anime.trending ? 'This is currently trending!' : ''}

Requirements:
- 60 seconds maximum
- Hook viewers in first 2 seconds
- Include on-screen text suggestions
- Optimized for YouTube's algorithm
- Include chapter timestamps suggestion

Format as:
[HOOK (0-2 seconds)]
<attention grabber>

[INTRO (2-10 seconds)]
<introduce the topic>

[MAIN CONTENT (10-50 seconds)]
<main discussion points>

[CTA (50-60 seconds)]
<subscribe and engage call>

[SUGGESTED TITLE]
<catchy title under 60 chars>

[TAGS]
<comma-separated tags for YouTube>`

    const response = await this.callClaudeAPI(prompt, 1200)

    // Reuse reel parser with modifications
    const parsed = this.parseReelScript(response)
    parsed.estimatedDuration = '60 seconds'

    return parsed
  }

  // Generate TikTok script
  async generateTikTokScript(anime: AnimeData): Promise<ReelScript> {
    const prompt = `Create a TikTok video script for the anime "${anime.title}" Episode ${anime.episode}.

Context:
- Genre: ${anime.genre}
- ${anime.trending ? 'Trending on social media!' : ''}

Requirements:
- 15-30 seconds (TikTok sweet spot)
- Use trending audio/sound suggestions
- Fast-paced, high energy
- Include text overlay suggestions
- Duet/stitch potential

Format as:
[HOOK (0-3 seconds)]
<viral hook>

[CONTENT (3-25 seconds)]
<main content with visual cues>

[CTA (25-30 seconds)]
<engagement driver>

[SOUND SUGGESTION]
<trending sound to use>

[HASHTAGS]
<TikTok-optimized hashtags>`

    const response = await this.callClaudeAPI(prompt, 1000)
    return this.parseReelScript(response)
  }

  // Save generated content to Firestore
  async saveContent(
    anime: AnimeData,
    contentType: GeneratedContent['contentType'],
    platform: GeneratedContent['platform'],
    content: ReelScript | GeneratedPost
  ): Promise<string> {
    const isReel = 'fullScript' in content

    const contentDoc: Omit<GeneratedContent, 'id' | 'createdAt'> = {
      animeId: anime.title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      animeTitle: anime.title,
      contentType,
      platform,
      caption: isReel ? content.fullScript : content.caption,
      script: isReel ? content.fullScript : undefined,
      imagePrompt: isReel ? undefined : content.imagePrompt,
      hashtags: content.hashtags,
      posted: false
    }

    return firestoreHelpers.saveGeneratedContent(contentDoc)
  }

  // Batch generate content for multiple anime
  async batchGenerate(
    animeList: AnimeData[],
    contentTypes: GeneratedContent['contentType'][]
  ): Promise<Map<string, GeneratedContent[]>> {
    const results = new Map<string, GeneratedContent[]>()

    for (const anime of animeList) {
      const animeContent: GeneratedContent[] = []

      for (const type of contentTypes) {
        try {
          let content: ReelScript | GeneratedPost

          switch (type) {
            case 'reel':
              content = await this.generateReelScript(anime)
              break
            case 'short':
              content = await this.generateYouTubeShort(anime)
              break
            case 'post':
              content = await this.generatePostCaption(anime)
              break
            default:
              content = await this.generatePostCaption(anime)
          }

          const id = await this.saveContent(anime, type, 'all', content)
          animeContent.push({
            id,
            animeId: anime.title,
            animeTitle: anime.title,
            contentType: type,
            platform: 'all',
            caption: 'fullScript' in content ? content.fullScript : content.caption,
            hashtags: content.hashtags,
            posted: false,
            createdAt: Timestamp.now()
          })

          // Rate limiting - wait between requests
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
          console.error(`Failed to generate ${type} for ${anime.title}:`, error)
        }
      }

      results.set(anime.title, animeContent)
    }

    return results
  }
}

// Export singleton instance
export const contentGenerator = new AIContentGenerator()
