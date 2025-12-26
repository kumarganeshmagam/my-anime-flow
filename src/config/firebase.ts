import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, orderBy, Timestamp, addDoc, updateDoc, deleteDoc } from 'firebase/firestore'

// Firebase configuration - uses environment variables in production
// For local development, you can use the accountsdb-cd480 project
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'accountsdb-cd480.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'accountsdb-cd480',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'accountsdb-cd480.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

// Collection references
export const COLLECTIONS = {
  SCRAPES: 'scrapes',
  SCHEDULES: 'schedules',
  SCHEDULE_HISTORY: 'schedule_history',
  GENERATED_CONTENT: 'generated_content',
  SETTINGS: 'settings'
} as const

// Types
export interface AnimeData {
  title: string
  day: string
  time: string
  episode: string
  image: string
  date: string
  trending: boolean
  genre: string
  malId?: number
  totalEpisodes?: number
  studio?: string
  rating?: number
}

export interface ScrapeDocument {
  date: string
  anime: AnimeData[]
  scrapedAt: Timestamp
}

export interface ScheduleDocument {
  animeId: string
  title: string
  totalEpisodes: number
  currentEpisode: number
  dayOfWeek: string
  airTime: string
  timezone: string
  autoScheduled: boolean
  nextEpisodes: {
    episode: number
    date: string
    confirmed: boolean
  }[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface GeneratedContent {
  id?: string
  animeId: string
  animeTitle: string
  contentType: 'reel' | 'short' | 'story' | 'post' | 'carousel'
  platform: 'instagram' | 'youtube' | 'tiktok' | 'all'
  caption: string
  script?: string
  imagePrompt?: string
  hashtags: string[]
  createdAt: Timestamp
  posted: boolean
}

// Helper functions
export const firestoreHelpers = {
  // Save scraped anime data
  async saveScrape(date: string, anime: AnimeData[]): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.SCRAPES, date)
      await setDoc(docRef, {
        date,
        anime,
        scrapedAt: Timestamp.now()
      })
      console.log('Scrape saved successfully for date:', date)
    } catch (error) {
      console.error('Error saving scrape:', error)
      throw error
    }
  },

  // Get scrape for a specific date
  async getScrape(date: string): Promise<ScrapeDocument | null> {
    try {
      const docRef = doc(db, COLLECTIONS.SCRAPES, date)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        return docSnap.data() as ScrapeDocument
      }
      return null
    } catch (error) {
      console.error('Error getting scrape:', error)
      return null
    }
  },

  // Get recent scrapes
  async getRecentScrapes(limit: number = 7): Promise<ScrapeDocument[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.SCRAPES),
        orderBy('scrapedAt', 'desc')
      )
      const snapshot = await getDocs(q)
      return snapshot.docs.slice(0, limit).map(doc => doc.data() as ScrapeDocument)
    } catch (error) {
      console.error('Error getting recent scrapes:', error)
      return []
    }
  },

  // Save auto-schedule
  async saveSchedule(schedule: Omit<ScheduleDocument, 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.SCHEDULES, schedule.animeId)
      await setDoc(docRef, {
        ...schedule,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
    } catch (error) {
      console.error('Error saving schedule:', error)
      throw error
    }
  },

  // Get all schedules
  async getSchedules(): Promise<ScheduleDocument[]> {
    try {
      const q = query(collection(db, COLLECTIONS.SCHEDULES), orderBy('updatedAt', 'desc'))
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => doc.data() as ScheduleDocument)
    } catch (error) {
      console.error('Error getting schedules:', error)
      return []
    }
  },

  // Save generated content
  async saveGeneratedContent(content: Omit<GeneratedContent, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.GENERATED_CONTENT), {
        ...content,
        createdAt: Timestamp.now()
      })
      return docRef.id
    } catch (error) {
      console.error('Error saving generated content:', error)
      throw error
    }
  },

  // Get all generated content
  async getGeneratedContent(): Promise<GeneratedContent[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.GENERATED_CONTENT),
        orderBy('createdAt', 'desc')
      )
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as GeneratedContent))
    } catch (error) {
      console.error('Error getting generated content:', error)
      return []
    }
  },

  // Mark content as posted
  async markAsPosted(contentId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.GENERATED_CONTENT, contentId)
      await updateDoc(docRef, { posted: true })
    } catch (error) {
      console.error('Error marking content as posted:', error)
      throw error
    }
  },

  // Delete content
  async deleteContent(contentId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.GENERATED_CONTENT, contentId)
      await deleteDoc(docRef)
    } catch (error) {
      console.error('Error deleting content:', error)
      throw error
    }
  },

  // Save settings
  async saveSettings(settings: Record<string, unknown>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.SETTINGS, 'user_settings')
      await setDoc(docRef, {
        ...settings,
        updatedAt: Timestamp.now()
      })
    } catch (error) {
      console.error('Error saving settings:', error)
      throw error
    }
  },

  // Get settings
  async getSettings(): Promise<Record<string, unknown> | null> {
    try {
      const docRef = doc(db, COLLECTIONS.SETTINGS, 'user_settings')
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        return docSnap.data()
      }
      return null
    } catch (error) {
      console.error('Error getting settings:', error)
      return null
    }
  }
}

export { Timestamp }
