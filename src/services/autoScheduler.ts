import { format } from 'date-fns'
import { firestoreHelpers, type AnimeData, type ScheduleDocument } from '../config/firebase'

export interface ScheduledEpisode {
  episode: number
  date: string
  airTime: string
  confirmed: boolean
}

export interface ScheduleChange {
  type: 'new' | 'time_change' | 'delay' | 'cancellation' | 'episode_update'
  anime: string
  details: string
  oldValue?: string
  newValue?: string
  detectedAt: Date
}

export class AnimeAutoScheduler {
  // Day name to number mapping
  private dayToNumber: Record<string, number> = {
    'Sunday': 0,
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6
  }

  // Auto-schedule future episodes for an anime
  async autoScheduleEpisodes(anime: AnimeData): Promise<ScheduledEpisode[]> {
    const currentEpisode = parseInt(anime.episode) || 1

    // Determine total episodes (default to 12 for seasonal anime)
    const totalEpisodes = anime.totalEpisodes || await this.estimateTotalEpisodes(anime.title, currentEpisode)

    const futureSchedule: ScheduledEpisode[] = []

    // Calculate future episode dates
    for (let ep = currentEpisode + 1; ep <= totalEpisodes; ep++) {
      const weeksFromNow = ep - currentEpisode
      const episodeDate = this.calculateFutureDate(anime.day, weeksFromNow)

      futureSchedule.push({
        episode: ep,
        date: episodeDate,
        airTime: anime.time,
        confirmed: false
      })
    }

    // Save to Firestore
    await this.saveScheduleToFirestore(anime, currentEpisode, totalEpisodes, futureSchedule)

    console.log(`Auto-scheduled ${futureSchedule.length} future episodes for ${anime.title}`)
    return futureSchedule
  }

  // Calculate future date based on day of week and weeks from now
  private calculateFutureDate(dayOfWeek: string, weeksFromNow: number): string {
    const today = new Date()
    const targetDayNum = this.dayToNumber[dayOfWeek] ?? 0
    const currentDayNum = today.getDay()

    // Calculate days until next occurrence of target day
    let daysUntilTarget = targetDayNum - currentDayNum
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7
    }

    // Add weeks
    const futureDate = new Date(today)
    futureDate.setDate(futureDate.getDate() + daysUntilTarget + (weeksFromNow - 1) * 7)

    return format(futureDate, 'yyyy-MM-dd')
  }

  // Estimate total episodes based on anime type
  private async estimateTotalEpisodes(title: string, currentEpisode: number): Promise<number> {
    // Long-running anime detection
    const longRunning = [
      'one piece', 'boruto', 'dragon ball', 'detective conan', 'case closed',
      'pokemon', 'naruto', 'bleach', 'fairy tail', 'black clover'
    ]

    if (longRunning.some(lr => title.toLowerCase().includes(lr))) {
      return currentEpisode + 52 // Assume year-round
    }

    // 2-cour anime (24 episodes) detection
    const twoCour = ['kingdom', 'frieren', 'mushoku tensei']
    if (twoCour.some(tc => title.toLowerCase().includes(tc))) {
      return Math.max(24, currentEpisode)
    }

    // Default to 12 episodes (1-cour seasonal)
    return Math.max(12, currentEpisode)
  }

  // Save schedule to Firestore
  private async saveScheduleToFirestore(
    anime: AnimeData,
    currentEpisode: number,
    totalEpisodes: number,
    futureSchedule: ScheduledEpisode[]
  ): Promise<void> {
    const schedule: Omit<ScheduleDocument, 'createdAt' | 'updatedAt'> = {
      animeId: anime.title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      title: anime.title,
      totalEpisodes,
      currentEpisode,
      dayOfWeek: anime.day,
      airTime: anime.time,
      timezone: 'JST',
      autoScheduled: true,
      nextEpisodes: futureSchedule
    }

    await firestoreHelpers.saveSchedule(schedule)
  }

  // Detect changes between today's scrape and yesterday's
  async detectChanges(todayScrape: AnimeData[], yesterdayScrape: AnimeData[]): Promise<ScheduleChange[]> {
    const changes: ScheduleChange[] = []
    const now = new Date()

    // Create lookup for yesterday's data
    const yesterdayMap = new Map<string, AnimeData>()
    yesterdayScrape.forEach(anime => {
      yesterdayMap.set(anime.title.toLowerCase(), anime)
    })

    // Check each anime from today's scrape
    for (const today of todayScrape) {
      const key = today.title.toLowerCase()
      const yesterday = yesterdayMap.get(key)

      // New anime detected
      if (!yesterday) {
        changes.push({
          type: 'new',
          anime: today.title,
          details: `New anime added to schedule: ${today.day} at ${today.time} JST`,
          detectedAt: now
        })
        continue
      }

      // Time change detected
      if (today.time !== yesterday.time) {
        changes.push({
          type: 'time_change',
          anime: today.title,
          details: `Air time changed from ${yesterday.time} to ${today.time}`,
          oldValue: yesterday.time,
          newValue: today.time,
          detectedAt: now
        })
      }

      // Day change (delay) detected
      if (today.day !== yesterday.day) {
        changes.push({
          type: 'delay',
          anime: today.title,
          details: `Broadcast day changed from ${yesterday.day} to ${today.day}`,
          oldValue: yesterday.day,
          newValue: today.day,
          detectedAt: now
        })
      }

      // Episode update detected
      if (today.episode !== yesterday.episode) {
        changes.push({
          type: 'episode_update',
          anime: today.title,
          details: `Episode updated from ${yesterday.episode} to ${today.episode}`,
          oldValue: yesterday.episode,
          newValue: today.episode,
          detectedAt: now
        })
      }

      // Remove from map to track removed anime
      yesterdayMap.delete(key)
    }

    // Check for removed anime (potential cancellation)
    for (const [, anime] of yesterdayMap) {
      changes.push({
        type: 'cancellation',
        anime: anime.title,
        details: `Anime removed from schedule (possible cancellation or season end)`,
        detectedAt: now
      })
    }

    return changes
  }

  // Get all future scheduled episodes for display
  async getFutureSchedule(): Promise<ScheduleDocument[]> {
    return firestoreHelpers.getSchedules()
  }

  // Update schedule when new episode airs
  async updateScheduleAfterAiring(animeId: string): Promise<void> {
    const schedules = await firestoreHelpers.getSchedules()
    const schedule = schedules.find(s => s.animeId === animeId)

    if (!schedule) return

    // Move to next episode
    const newEpisode = schedule.currentEpisode + 1

    // Remove the aired episode from future schedule
    const updatedNextEpisodes = schedule.nextEpisodes.filter(
      ep => ep.episode > newEpisode
    )

    await firestoreHelpers.saveSchedule({
      ...schedule,
      currentEpisode: newEpisode,
      nextEpisodes: updatedNextEpisodes
    })
  }

  // Confirm a scheduled episode date
  async confirmEpisodeDate(animeId: string, episodeNumber: number): Promise<void> {
    const schedules = await firestoreHelpers.getSchedules()
    const schedule = schedules.find(s => s.animeId === animeId)

    if (!schedule) return

    const updatedNextEpisodes = schedule.nextEpisodes.map(ep => {
      if (ep.episode === episodeNumber) {
        return { ...ep, confirmed: true }
      }
      return ep
    })

    await firestoreHelpers.saveSchedule({
      ...schedule,
      nextEpisodes: updatedNextEpisodes
    })
  }
}

// Export singleton instance
export const autoScheduler = new AnimeAutoScheduler()
