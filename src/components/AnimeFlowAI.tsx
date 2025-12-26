import React, { useState, useEffect, useCallback } from 'react'
import {
  Calendar, Sparkles, RefreshCw, Download, ChevronLeft, ChevronRight,
  PlayCircle, TrendingUp, Clock, Loader, Zap, AlertCircle,
  CheckCircle, Film, Instagram, Youtube
} from 'lucide-react'
import { scraper } from '../services/webScraper'
import { autoScheduler, type ScheduleChange } from '../services/autoScheduler'
import { contentGenerator } from '../services/contentGenerator'
import { firestoreHelpers, type AnimeData } from '../config/firebase'

const AnimeFlowAI: React.FC = () => {
  const [animeSchedule, setAnimeSchedule] = useState<AnimeData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isScraping, setIsScraping] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scheduleChanges, setScheduleChanges] = useState<ScheduleChange[]>([])
  const [showChangeAlert, setShowChangeAlert] = useState(false)
  const [generatingContent, setGeneratingContent] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Load data on mount
  useEffect(() => {
    loadInitialData()
  }, [])

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Load initial data from cache or scrape
  const loadInitialData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Try to load from Firestore first
      const today = new Date().toISOString().split('T')[0]
      const cachedData = await firestoreHelpers.getScrape(today)

      if (cachedData && cachedData.anime.length > 0) {
        setAnimeSchedule(cachedData.anime)
        setLastSync(cachedData.scrapedAt.toDate())
        console.log('Loaded from cache')
      } else {
        // Scrape fresh data
        await refreshData()
      }
    } catch (err) {
      console.error('Error loading initial data:', err)
      // Fall back to scraper's fallback data
      const fallbackData = scraper.getFallbackSchedule()
      setAnimeSchedule(fallbackData)
      setError('Using offline data. Connect to internet for live updates.')
    } finally {
      setIsLoading(false)
    }
  }

  // Refresh data from web
  const refreshData = async () => {
    setIsScraping(true)
    setError(null)

    try {
      // Get yesterday's data for change detection
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]
      const yesterdayData = await firestoreHelpers.getScrape(yesterdayStr)

      // Scrape new data
      const scrapedData = await scraper.scrapeAniwatch()
      setAnimeSchedule(scrapedData)
      setLastSync(new Date())

      // Save to Firestore
      const today = new Date().toISOString().split('T')[0]
      await firestoreHelpers.saveScrape(today, scrapedData)

      // Detect changes
      if (yesterdayData && yesterdayData.anime.length > 0) {
        const changes = await autoScheduler.detectChanges(scrapedData, yesterdayData.anime)
        if (changes.length > 0) {
          setScheduleChanges(changes)
          setShowChangeAlert(true)
        }
      }

      // Auto-schedule new anime
      for (const anime of scrapedData) {
        if (anime.trending) {
          await autoScheduler.autoScheduleEpisodes(anime)
        }
      }

      showToast('Schedule synced successfully!')
    } catch (err) {
      console.error('Error refreshing data:', err)
      setError('Failed to sync. Using cached data.')
      showToast('Sync failed. Using cached data.', 'error')
    } finally {
      setIsScraping(false)
    }
  }

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    return {
      daysInMonth: lastDay.getDate(),
      startingDayOfWeek: firstDay.getDay()
    }
  }

  const getAnimeForDate = useCallback((date: Date): AnimeData[] => {
    const dateStr = date.toISOString().split('T')[0]
    return animeSchedule.filter(anime => anime.date === dateStr)
  }, [animeSchedule])

  const changeMonth = (direction: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1))
  }

  // Export functions
  const exportSchedule = (type: 'day' | 'week' | 'trending') => {
    let data: AnimeData[] = []
    let filename = ''

    switch (type) {
      case 'day':
        data = getAnimeForDate(selectedDate)
        filename = `anime-schedule-${selectedDate.toISOString().split('T')[0]}`
        break
      case 'week':
        data = animeSchedule
        filename = `anime-schedule-week-${new Date().toISOString().split('T')[0]}`
        break
      case 'trending':
        data = animeSchedule.filter(a => a.trending)
        filename = `anime-trending-${new Date().toISOString().split('T')[0]}`
        break
    }

    const text = data.map(a =>
      `${a.title}\n${a.day} at ${a.time} JST • Episode ${a.episode}\n${a.trending ? 'TRENDING' : ''}\nGenre: ${a.genre}\n---`
    ).join('\n\n')

    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.txt`
    link.click()
    URL.revokeObjectURL(url)

    showToast('Schedule exported!')
  }

  // Generate AI content for anime
  const handleGenerateContent = async (anime: AnimeData, type: 'reel' | 'post' | 'short') => {
    if (!contentGenerator.isConfigured()) {
      showToast('Please add your Anthropic API key in Settings', 'error')
      return
    }

    setGeneratingContent(anime.title)

    try {
      let content
      switch (type) {
        case 'reel':
          content = await contentGenerator.generateReelScript(anime)
          await contentGenerator.saveContent(anime, 'reel', 'instagram', content)
          break
        case 'post':
          content = await contentGenerator.generatePostCaption(anime)
          await contentGenerator.saveContent(anime, 'post', 'instagram', content)
          break
        case 'short':
          content = await contentGenerator.generateYouTubeShort(anime)
          await contentGenerator.saveContent(anime, 'short', 'youtube', content)
          break
      }

      showToast(`${type} content generated! Check Content Library.`)
    } catch (err) {
      console.error('Error generating content:', err)
      showToast('Failed to generate content. Check your API key.', 'error')
    } finally {
      setGeneratingContent(null)
    }
  }

  // Render
  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth)
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const todayAnime = getAnimeForDate(selectedDate)
  const trendingCount = animeSchedule.filter(a => a.trending).length
  const selectedDateStr = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // Loading state
  if (isLoading && animeSchedule.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin text-purple-400 mx-auto mb-4" size={64} />
          <h2 className="text-2xl font-bold text-white">Loading Anime Schedule...</h2>
          <p className="text-gray-400 mt-2">Fetching latest data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 toast-enter ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Schedule Changes Alert */}
      {showChangeAlert && scheduleChanges.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-white/10 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <AlertCircle className="text-yellow-400" />
              Schedule Changes Detected
            </h3>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {scheduleChanges.map((change, idx) => (
                <div key={idx} className="bg-slate-700/50 rounded-lg p-3">
                  <div className="font-semibold text-white">{change.anime}</div>
                  <div className="text-sm text-gray-300">{change.details}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {change.type.replace('_', ' ').toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowChangeAlert(false)}
              className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-black/30 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent flex items-center gap-2">
                <Sparkles className="text-purple-400" size={28} />
                AnimeFlow AI
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                {animeSchedule.length} anime tracked • AI-powered content automation
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastSync && (
                <div className="text-right hidden sm:block">
                  <div className="text-xs text-gray-500">Last synced</div>
                  <div className="text-sm text-gray-300">{lastSync.toLocaleTimeString()}</div>
                </div>
              )}
              <button
                onClick={refreshData}
                disabled={isScraping}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2 shadow-lg transition-all"
              >
                <RefreshCw className={isScraping ? 'animate-spin' : ''} size={20} />
                {isScraping ? 'Syncing...' : 'Sync Data'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="text-red-400 flex-shrink-0" />
            <span className="text-red-200">{error}</span>
          </div>
        )}

        {/* Quick Stats */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-red-600 to-pink-600 p-3 rounded-xl">
                <PlayCircle size={20} className="text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{todayAnime.length}</div>
                <div className="text-xs text-gray-400">On {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              </div>
            </div>

            <div className="w-px h-12 bg-white/10 hidden sm:block" />

            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-orange-600 to-yellow-600 p-3 rounded-xl">
                <TrendingUp size={20} className="text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{trendingCount}</div>
                <div className="text-xs text-gray-400">Trending</div>
              </div>
            </div>

            <div className="w-px h-12 bg-white/10 hidden sm:block" />

            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-3 rounded-xl">
                <Calendar size={20} className="text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{animeSchedule.length}</div>
                <div className="text-xs text-gray-400">This Week</div>
              </div>
            </div>

            <div className="w-px h-12 bg-white/10 hidden sm:block" />

            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-green-600 to-emerald-600 p-3 rounded-xl">
                <Zap size={20} className="text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{contentGenerator.isConfigured() ? 'Ready' : 'Setup'}</div>
                <div className="text-xs text-gray-400">AI Status</div>
              </div>
            </div>
          </div>
        </div>

        {/* Export Bar */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-white">Quick Export</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => exportSchedule('day')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
              >
                <Download size={16} />
                Selected Day
              </button>
              <button
                onClick={() => exportSchedule('week')}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
              >
                <Download size={16} />
                Full Week
              </button>
              <button
                onClick={() => exportSchedule('trending')}
                className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors"
              >
                <Download size={16} />
                Trending
              </button>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">{monthName}</h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => changeMonth(-1)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={() => {
                  setCurrentMonth(new Date())
                  setSelectedDate(new Date())
                }}
                className="px-3 py-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 text-sm"
              >
                Today
              </button>
              <button
                onClick={() => changeMonth(1)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {days.map(day => (
              <div key={day} className="text-center font-bold text-gray-400 text-sm py-2">
                {day}
              </div>
            ))}

            {Array.from({ length: startingDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
              const anime = getAnimeForDate(date)
              const isToday = date.toDateString() === new Date().toDateString()
              const isSelected = date.toDateString() === selectedDate.toDateString()
              const releasing = anime.length
              const trending = anime.filter(a => a.trending).length

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(date)}
                  className={`min-h-24 sm:min-h-28 border-2 rounded-xl p-2 cursor-pointer transition-all ${
                    isToday
                      ? 'border-purple-400 bg-purple-900/30 ring-2 ring-purple-400'
                      : isSelected
                        ? 'border-blue-400 bg-blue-900/30 ring-2 ring-blue-400'
                        : 'border-white/10 bg-white/5 hover:border-purple-300 hover:bg-white/10'
                  }`}
                >
                  <div className={`text-sm font-bold mb-2 ${
                    isToday ? 'text-purple-300' : isSelected ? 'text-blue-300' : 'text-white'
                  }`}>
                    {day}
                  </div>

                  {anime.length > 0 && (
                    <div className="space-y-1">
                      {releasing > 0 && (
                        <div className="text-xs bg-gradient-to-r from-red-500 to-pink-500 text-white px-2 py-1 rounded-md font-bold text-center">
                          {releasing} LIVE
                        </div>
                      )}
                      {trending > 0 && (
                        <div className="text-xs bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-2 py-1 rounded-md font-bold text-center">
                          {trending} HOT
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Selected Date Anime */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-4">
            {selectedDateStr}
          </h2>

          {todayAnime.length === 0 ? (
            <div className="text-center py-12">
              <Calendar size={64} className="mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 text-lg">No anime scheduled for this date</p>
              <p className="text-gray-500 text-sm mt-2">Select another date or sync for updates</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {todayAnime.map((anime, idx) => (
                <div
                  key={idx}
                  className="group bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden border-2 border-white/10 hover:border-purple-400 transition-all"
                >
                  <div className="relative h-64">
                    <img
                      src={anime.image}
                      alt={anime.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/247x350?text=No+Image'
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

                    {anime.trending && (
                      <div className="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs px-3 py-1.5 rounded-full font-bold animate-pulse">
                        TRENDING
                      </div>
                    )}

                    <div className="absolute bottom-3 left-3 right-3">
                      <h4 className="text-white font-bold mb-2 line-clamp-2">
                        {anime.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-purple-600 text-white px-2 py-1 rounded font-semibold flex items-center gap-1">
                          <Clock size={12} />
                          {anime.time} JST
                        </span>
                        <span className="bg-blue-600 text-white px-2 py-1 rounded font-semibold">
                          Ep {anime.episode}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <p className="text-gray-400 text-sm">{anime.genre}</p>

                    {/* AI Content Generation Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleGenerateContent(anime, 'reel')}
                        disabled={generatingContent === anime.title}
                        className="flex-1 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50 transition-all"
                      >
                        {generatingContent === anime.title ? (
                          <Loader className="animate-spin" size={14} />
                        ) : (
                          <Instagram size={14} />
                        )}
                        Reel
                      </button>
                      <button
                        onClick={() => handleGenerateContent(anime, 'post')}
                        disabled={generatingContent === anime.title}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50 transition-all"
                      >
                        {generatingContent === anime.title ? (
                          <Loader className="animate-spin" size={14} />
                        ) : (
                          <Film size={14} />
                        )}
                        Post
                      </button>
                      <button
                        onClick={() => handleGenerateContent(anime, 'short')}
                        disabled={generatingContent === anime.title}
                        className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50 transition-all"
                      >
                        {generatingContent === anime.title ? (
                          <Loader className="animate-spin" size={14} />
                        ) : (
                          <Youtube size={14} />
                        )}
                        Short
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AnimeFlowAI
