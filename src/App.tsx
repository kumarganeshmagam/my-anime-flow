import { useState, useEffect } from 'react'
import AnimeFlowAI from './components/AnimeFlowAI'
import Settings from './components/Settings'
import ContentLibrary from './components/ContentLibrary'
import { Settings as SettingsIcon, Home, BookOpen } from 'lucide-react'

type View = 'home' | 'settings' | 'library'

function App() {
  const [currentView, setCurrentView] = useState<View>('home')
  const [isSettingsConfigured, setIsSettingsConfigured] = useState(false)

  useEffect(() => {
    // Check if Firebase and API keys are configured
    const anthropicKey = localStorage.getItem('anthropic_api_key')
    setIsSettingsConfigured(!!anthropicKey)
  }, [])

  const renderView = () => {
    switch (currentView) {
      case 'settings':
        return <Settings onClose={() => setCurrentView('home')} />
      case 'library':
        return <ContentLibrary onBack={() => setCurrentView('home')} />
      default:
        return <AnimeFlowAI />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-black/80 backdrop-blur-xl rounded-full p-2 border border-white/20 shadow-2xl flex items-center gap-2">
          <button
            onClick={() => setCurrentView('home')}
            className={`p-3 rounded-full transition-all ${
              currentView === 'home'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title="Home"
          >
            <Home size={20} />
          </button>

          <button
            onClick={() => setCurrentView('library')}
            className={`p-3 rounded-full transition-all ${
              currentView === 'library'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title="Content Library"
          >
            <BookOpen size={20} />
          </button>

          <button
            onClick={() => setCurrentView('settings')}
            className={`p-3 rounded-full transition-all relative ${
              currentView === 'settings'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title="Settings"
          >
            <SettingsIcon size={20} />
            {!isSettingsConfigured && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pb-24">
        {renderView()}
      </main>
    </div>
  )
}

export default App
