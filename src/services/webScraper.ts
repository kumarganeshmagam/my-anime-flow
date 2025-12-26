import type { AnimeData } from '../config/firebase'

// CORS proxy list with fallbacks
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://thingproxy.freeboard.io/fetch/'
]

// Retry configuration
const MAX_RETRIES = 3
const INITIAL_DELAY = 1000 // 1 second

// Sleep helper for retry delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Exponential backoff delay calculation
const getBackoffDelay = (attempt: number, baseDelay: number): number => {
  return baseDelay * Math.pow(2, attempt)
}

export class AnimeDataScraper {
  private sources = {
    aniwatch: 'https://aniwatch.com.cv/schedule/'
  }

  // Scrape with retry logic and proxy fallbacks
  async scrapeAniwatch(): Promise<AnimeData[]> {
    for (let proxyIndex = 0; proxyIndex < CORS_PROXIES.length; proxyIndex++) {
      const proxy = CORS_PROXIES[proxyIndex]

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const url = proxy + encodeURIComponent(this.sources.aniwatch)
          console.log(`Attempt ${attempt + 1} with proxy ${proxyIndex + 1}: ${proxy}`)

          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 sec timeout

          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const html = await response.text()

          if (!html || html.length < 1000) {
            throw new Error('Response too short, likely blocked')
          }

          const parsed = this.parseAniwatchHTML(html)

          if (parsed.length > 0) {
            console.log(`Successfully scraped ${parsed.length} anime entries`)
            return parsed
          }

          throw new Error('No anime data found in response')
        } catch (error) {
          console.warn(`Attempt ${attempt + 1} failed:`, error)

          if (attempt < MAX_RETRIES - 1) {
            const delay = getBackoffDelay(attempt, INITIAL_DELAY)
            console.log(`Retrying in ${delay}ms...`)
            await sleep(delay)
          }
        }
      }
    }

    console.warn('All proxies failed, returning fallback data')
    return this.getFallbackSchedule()
  }

  // Parse Aniwatch HTML
  private parseAniwatchHTML(html: string): AnimeData[] {
    const schedule: AnimeData[] = []
    const today = new Date()

    try {
      // Create a DOM parser
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      // Find schedule sections - Aniwatch typically has schedule blocks
      const scheduleBlocks = doc.querySelectorAll('.schedule-block, .anime-schedule, [class*="schedule"]')

      if (scheduleBlocks.length === 0) {
        // Try alternative parsing
        const animeItems = doc.querySelectorAll('.anime-item, .schedule-item, article')

        animeItems.forEach((item: Element) => {
          const titleEl = item.querySelector('h3, h4, .title, [class*="title"]')
          const timeEl = item.querySelector('.time, [class*="time"]')
          const imageEl = item.querySelector('img')
          const episodeEl = item.querySelector('.episode, [class*="episode"]')

          if (titleEl) {
            const title = titleEl.textContent?.trim() || ''
            const time = timeEl?.textContent?.trim() || 'TBA'
            const image = imageEl?.getAttribute('src') || imageEl?.getAttribute('data-src') || ''
            const episode = episodeEl?.textContent?.trim()?.replace(/[^0-9]/g, '') || 'New'

            // Determine day from context
            const parentText = item.closest('section')?.textContent?.toLowerCase() || ''
            let day = 'Unknown'
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            for (const d of days) {
              if (parentText.includes(d.toLowerCase())) {
                day = d
                break
              }
            }

            schedule.push({
              title,
              day,
              time,
              episode,
              image,
              date: this.getDateForDay(day, today),
              trending: this.detectTrending(item, title),
              genre: this.extractGenre(item)
            })
          }
        })
      } else {
        // Parse schedule blocks
        scheduleBlocks.forEach((block: Element) => {
          const dayHeader = block.querySelector('h2, h3, .day-header')
          const day = dayHeader?.textContent?.trim() || 'Unknown'

          const animeList = block.querySelectorAll('.anime-item, li, .schedule-anime')
          animeList.forEach((anime: Element) => {
            const title = anime.querySelector('.title, h4, a')?.textContent?.trim() || ''
            const time = anime.querySelector('.time, .release-time')?.textContent?.trim() || 'TBA'
            const image = anime.querySelector('img')?.getAttribute('src') || ''
            const episode = anime.querySelector('.episode')?.textContent?.trim() || 'New'

            if (title) {
              schedule.push({
                title,
                day: this.normalizeDay(day),
                time,
                episode: episode.replace(/[^0-9]/g, '') || 'New',
                image,
                date: this.getDateForDay(day, today),
                trending: this.detectTrending(anime, title),
                genre: this.extractGenre(anime)
              })
            }
          })
        })
      }
    } catch (error) {
      console.error('Error parsing HTML:', error)
    }

    return schedule
  }

  // Detect if anime is trending
  private detectTrending(element: Element, title: string): boolean {
    const trendingIndicators = [
      'trending', 'popular', 'hot', 'top', 'featured'
    ]

    const classList = element.className.toLowerCase()
    const elementText = element.textContent?.toLowerCase() || ''

    if (trendingIndicators.some(ind => classList.includes(ind) || elementText.includes(ind))) {
      return true
    }

    // Known trending anime (manually maintained list)
    const knownTrending = [
      'one piece', 'demon slayer', 'spy x family', 'jujutsu kaisen',
      'one punch man', 'attack on titan', 'my hero academia', 'chainsaw man',
      'blue lock', 'solo leveling', 'frieren', 'oshi no ko'
    ]

    return knownTrending.some(t => title.toLowerCase().includes(t))
  }

  // Extract genre from element
  private extractGenre(element: Element): string {
    const genreEl = element.querySelector('.genre, .genres, [class*="genre"]')
    if (genreEl) {
      return genreEl.textContent?.trim() || 'Unknown'
    }

    // Check for genre tags
    const tags = element.querySelectorAll('.tag, .genre-tag')
    if (tags.length > 0) {
      return Array.from(tags).map(t => t.textContent?.trim()).filter(Boolean).join(', ')
    }

    return 'Anime'
  }

  // Normalize day name
  private normalizeDay(day: string): string {
    const normalized = day.toLowerCase().trim()
    const days: Record<string, string> = {
      'sun': 'Sunday', 'sunday': 'Sunday',
      'mon': 'Monday', 'monday': 'Monday',
      'tue': 'Tuesday', 'tuesday': 'Tuesday',
      'wed': 'Wednesday', 'wednesday': 'Wednesday',
      'thu': 'Thursday', 'thursday': 'Thursday',
      'fri': 'Friday', 'friday': 'Friday',
      'sat': 'Saturday', 'saturday': 'Saturday'
    }
    return days[normalized] || day
  }

  // Calculate date for a given day of week
  private getDateForDay(dayName: string, reference: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const currentDay = reference.getDay()
    const targetDay = days.indexOf(this.normalizeDay(dayName))

    if (targetDay === -1) return reference.toISOString().split('T')[0]

    let diff = targetDay - currentDay

    const date = new Date(reference)
    date.setDate(date.getDate() + diff)
    return date.toISOString().split('T')[0]
  }

  // Fallback schedule when scraping fails
  getFallbackSchedule(): AnimeData[] {
    const today = new Date()

    return [
      { title: "Demon Slayer: Kimetsu no Yaiba - Infinity Castle", day: "Thursday", time: "19:11", episode: "Movie", image: "https://cdn.myanimelist.net/images/anime/1286/99889.jpg", date: this.getDateForDay('Thursday', today), trending: true, genre: "Action, Supernatural" },
      { title: "This Monster Wants to Eat Me", day: "Thursday", time: "Released", episode: "13", image: "https://cdn.myanimelist.net/images/anime/1015/143559.jpg", date: this.getDateForDay('Thursday', today), trending: false, genre: "Horror" },
      { title: "So You're Raising a Warrior", day: "Friday", time: "03:00", episode: "11", image: "https://cdn.myanimelist.net/images/anime/1706/144109.jpg", date: this.getDateForDay('Friday', today), trending: false, genre: "Fantasy" },
      { title: "Tougen Anki", day: "Friday", time: "15:40", episode: "24", image: "https://cdn.myanimelist.net/images/anime/1100/141874.jpg", date: this.getDateForDay('Friday', today), trending: true, genre: "Action, Supernatural" },
      { title: "Ganglion", day: "Friday", time: "16:50", episode: "13", image: "https://cdn.myanimelist.net/images/anime/1908/143206.jpg", date: this.getDateForDay('Friday', today), trending: false, genre: "Horror" },
      { title: "Spy x Family Season 3", day: "Saturday", time: "15:15", episode: "13", image: "https://cdn.myanimelist.net/images/anime/1506/138982.jpg", date: this.getDateForDay('Saturday', today), trending: true, genre: "Action, Comedy" },
      { title: "To Your Eternity Season 3", day: "Saturday", time: "16:00", episode: "13", image: "https://cdn.myanimelist.net/images/anime/1271/138435.jpg", date: this.getDateForDay('Saturday', today), trending: true, genre: "Drama, Fantasy" },
      { title: "Kingdom: Season 6", day: "Saturday", time: "18:58", episode: "13", image: "https://cdn.myanimelist.net/images/anime/1809/143011.jpg", date: this.getDateForDay('Saturday', today), trending: false, genre: "Action, Historical" },
      { title: "One Piece", day: "Sunday", time: "16:05", episode: "1155", image: "https://cdn.myanimelist.net/images/anime/1244/138851.jpg", date: this.getDateForDay('Sunday', today), trending: true, genre: "Action, Adventure" },
      { title: "One-Punch Man Season 3", day: "Sunday", time: "16:25", episode: "12", image: "https://cdn.myanimelist.net/images/anime/1247/142693.jpg", date: this.getDateForDay('Sunday', today), trending: true, genre: "Action, Comedy" },
      { title: "A Mangaka's Weirdly Wonderful Workplace", day: "Monday", time: "13:10", episode: "13", image: "https://cdn.myanimelist.net/images/anime/1320/143874.jpg", date: this.getDateForDay('Monday', today), trending: false, genre: "Comedy, Slice of Life" },
      { title: "Plus-sized Misadventures in Love!", day: "Monday", time: "15:10", episode: "13", image: "https://cdn.myanimelist.net/images/anime/1736/143736.jpg", date: this.getDateForDay('Monday', today), trending: false, genre: "Romance" },
      { title: "Chitose Is in the Ramune Bottle", day: "Tuesday", time: "16:40", episode: "10", image: "https://cdn.myanimelist.net/images/anime/1741/143233.jpg", date: this.getDateForDay('Tuesday', today), trending: false, genre: "Romance, School" },
      { title: "Ninja vs. Gokudo", day: "Tuesday", time: "17:55", episode: "13", image: "https://cdn.myanimelist.net/images/anime/1522/144147.jpg", date: this.getDateForDay('Tuesday', today), trending: false, genre: "Action" },
      { title: "The Blue Orchestra Season 2", day: "Tuesday", time: "21:50", episode: "13", image: "https://cdn.myanimelist.net/images/anime/1796/143796.jpg", date: this.getDateForDay('Tuesday', today), trending: true, genre: "Music, Drama" },
      { title: "Forget That Night, Your Majesty", day: "Wednesday", time: "13:01", episode: "13", image: "https://cdn.myanimelist.net/images/anime/1926/143926.jpg", date: this.getDateForDay('Wednesday', today), trending: false, genre: "Romance, Fantasy" },
      { title: "Monster Strike: Deadverse Reloaded", day: "Wednesday", time: "14:44", episode: "5", image: "https://cdn.myanimelist.net/images/anime/1875/143875.jpg", date: this.getDateForDay('Wednesday', today), trending: false, genre: "Action" }
    ]
  }

  // Fetch additional data from MyAnimeList
  async fetchFromMyAnimeList(animeTitle: string): Promise<Partial<AnimeData> | null> {
    const malClientId = localStorage.getItem('mal_client_id')
    if (!malClientId) {
      console.warn('MAL Client ID not configured')
      return null
    }

    try {
      const response = await fetch(
        `https://api.myanimelist.net/v2/anime?q=${encodeURIComponent(animeTitle)}&limit=1`,
        {
          headers: {
            'X-MAL-CLIENT-ID': malClientId
          }
        }
      )

      if (!response.ok) {
        throw new Error(`MAL API error: ${response.status}`)
      }

      const data = await response.json()

      if (data.data && data.data.length > 0) {
        const anime = data.data[0].node
        return {
          malId: anime.id,
          totalEpisodes: anime.num_episodes,
          genre: anime.genres?.map((g: {name: string}) => g.name).join(', ') || 'Anime',
          studio: anime.studios?.[0]?.name,
          rating: anime.mean
        }
      }

      return null
    } catch (error) {
      console.error('Error fetching from MAL:', error)
      return null
    }
  }

  // Enrich anime data with additional sources
  async enrichAnimeData(animeList: AnimeData[]): Promise<AnimeData[]> {
    const enriched = await Promise.all(
      animeList.map(async (anime) => {
        try {
          const malData = await this.fetchFromMyAnimeList(anime.title)
          if (malData) {
            return { ...anime, ...malData }
          }
          return anime
        } catch {
          return anime
        }
      })
    )

    return enriched
  }
}

// Export singleton instance
export const scraper = new AnimeDataScraper()
