import React, { useState, useEffect } from 'react'
import {
  X, Key, Save, CheckCircle, AlertCircle, Eye, EyeOff,
  Database, Zap, ExternalLink, Shield, Sparkles
} from 'lucide-react'
import { contentGenerator } from '../services/contentGenerator'

interface SettingsProps {
  onClose: () => void
}

interface SettingsState {
  anthropicApiKey: string
  geminiApiKey: string
  malClientId: string
  defaultPlatform: 'instagram' | 'youtube' | 'tiktok' | 'all'
  contentTone: 'casual' | 'professional' | 'hype'
  autoScheduleEnabled: boolean
  notificationsEnabled: boolean
}

type ApiStatus = 'untested' | 'success' | 'error'

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<SettingsState>({
    anthropicApiKey: '',
    geminiApiKey: '',
    malClientId: '',
    defaultPlatform: 'all',
    contentTone: 'hype',
    autoScheduleEnabled: true,
    notificationsEnabled: true
  })

  const [showApiKey, setShowApiKey] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showMalKey, setShowMalKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testingAnthropicApi, setTestingAnthropicApi] = useState(false)
  const [testingGeminiApi, setTestingGeminiApi] = useState(false)
  const [anthropicApiStatus, setAnthropicApiStatus] = useState<ApiStatus>('untested')
  const [geminiApiStatus, setGeminiApiStatus] = useState<ApiStatus>('untested')

  // Load settings on mount
  useEffect(() => {
    const savedSettings: Partial<SettingsState> = {}

    savedSettings.anthropicApiKey = localStorage.getItem('anthropic_api_key') || ''
    savedSettings.geminiApiKey = localStorage.getItem('gemini_api_key') || ''
    savedSettings.malClientId = localStorage.getItem('mal_client_id') || ''
    savedSettings.defaultPlatform = (localStorage.getItem('default_platform') as SettingsState['defaultPlatform']) || 'all'
    savedSettings.contentTone = (localStorage.getItem('content_tone') as SettingsState['contentTone']) || 'hype'
    savedSettings.autoScheduleEnabled = localStorage.getItem('auto_schedule') !== 'false'
    savedSettings.notificationsEnabled = localStorage.getItem('notifications') !== 'false'

    setSettings(prev => ({ ...prev, ...savedSettings }))

    // Check if API keys exist
    if (savedSettings.anthropicApiKey) {
      setAnthropicApiStatus('untested')
    }
    if (savedSettings.geminiApiKey) {
      setGeminiApiStatus('untested')
    }
  }, [])

  // Save settings
  const handleSave = () => {
    localStorage.setItem('anthropic_api_key', settings.anthropicApiKey)
    localStorage.setItem('gemini_api_key', settings.geminiApiKey)
    localStorage.setItem('mal_client_id', settings.malClientId)
    localStorage.setItem('default_platform', settings.defaultPlatform)
    localStorage.setItem('content_tone', settings.contentTone)
    localStorage.setItem('auto_schedule', String(settings.autoScheduleEnabled))
    localStorage.setItem('notifications', String(settings.notificationsEnabled))

    // Refresh content generator keys
    contentGenerator.refreshKeys()

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Test Anthropic API connection
  const testAnthropicConnection = async () => {
    if (!settings.anthropicApiKey) {
      setAnthropicApiStatus('error')
      return
    }

    setTestingAnthropicApi(true)
    setAnthropicApiStatus('untested')

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say "ok"' }]
        })
      })

      if (response.ok) {
        setAnthropicApiStatus('success')
      } else {
        setAnthropicApiStatus('error')
      }
    } catch {
      setAnthropicApiStatus('error')
    } finally {
      setTestingAnthropicApi(false)
    }
  }

  // Test Gemini API connection
  const testGeminiConnection = async () => {
    if (!settings.geminiApiKey) {
      setGeminiApiStatus('error')
      return
    }

    setTestingGeminiApi(true)
    setGeminiApiStatus('untested')

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: 'Say "ok"' }]
            }],
            generationConfig: {
              maxOutputTokens: 10
            }
          })
        }
      )

      if (response.ok) {
        setGeminiApiStatus('success')
      } else {
        setGeminiApiStatus('error')
      }
    } catch {
      setGeminiApiStatus('error')
    } finally {
      setTestingGeminiApi(false)
    }
  }

  // Get status icon
  const getStatusIcon = (status: ApiStatus, testing: boolean) => {
    if (testing) {
      return <span className="animate-spin">...</span>
    }
    switch (status) {
      case 'success':
        return <CheckCircle size={18} className="text-green-400" />
      case 'error':
        return <AlertCircle size={18} className="text-red-400" />
      default:
        return <Zap size={18} />
    }
  }

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Settings</h1>
            <p className="text-gray-400 mt-1">Configure your AnimeFlow AI preferences</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          {/* API Keys Section */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Key className="text-purple-400" />
              AI API Keys
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Add at least one API key. Anthropic (Claude) is primary, Gemini is used as fallback.
            </p>

            <div className="space-y-4">
              {/* Anthropic API Key */}
              <div className="bg-slate-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <label className="text-sm font-medium text-gray-300">
                    Anthropic API Key (Claude)
                  </label>
                  <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded">PRIMARY</span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={settings.anthropicApiKey}
                      onChange={(e) => setSettings(prev => ({ ...prev, anthropicApiKey: e.target.value }))}
                      placeholder="sk-ant-..."
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 pr-10"
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button
                    onClick={testAnthropicConnection}
                    disabled={testingAnthropicApi || !settings.anthropicApiKey}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                  >
                    {getStatusIcon(anthropicApiStatus, testingAnthropicApi)}
                    Test
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Best quality AI content.{' '}
                  <a
                    href="https://console.anthropic.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-1"
                  >
                    Get key <ExternalLink size={12} />
                  </a>
                </p>
              </div>

              {/* Gemini API Key */}
              <div className="bg-slate-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <label className="text-sm font-medium text-gray-300">
                    Google Gemini API Key
                  </label>
                  <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">FALLBACK</span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      value={settings.geminiApiKey}
                      onChange={(e) => setSettings(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                      placeholder="AIza..."
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 pr-10"
                    />
                    <button
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showGeminiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button
                    onClick={testGeminiConnection}
                    disabled={testingGeminiApi || !settings.geminiApiKey}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                  >
                    {getStatusIcon(geminiApiStatus, testingGeminiApi)}
                    Test
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Free tier available. Used when Anthropic fails.{' '}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                  >
                    Get key <ExternalLink size={12} />
                  </a>
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="text-purple-400 flex-shrink-0 mt-0.5" size={16} />
                  <div className="text-xs text-gray-300">
                    <strong>How fallback works:</strong> The system tries Anthropic first. If it fails (rate limit, error, etc.),
                    Gemini is automatically used. You can configure just one or both.
                  </div>
                </div>
              </div>

              {/* MAL Client ID */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  MyAnimeList Client ID
                  <span className="text-gray-500 ml-1">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type={showMalKey ? 'text' : 'password'}
                    value={settings.malClientId}
                    onChange={(e) => setSettings(prev => ({ ...prev, malClientId: e.target.value }))}
                    placeholder="Enter MAL Client ID"
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 pr-10"
                  />
                  <button
                    onClick={() => setShowMalKey(!showMalKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showMalKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  For enriched anime data.{' '}
                  <a
                    href="https://myanimelist.net/apiconfig"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-1"
                  >
                    Get MAL API <ExternalLink size={12} />
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Content Preferences */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="text-yellow-400" />
              Content Preferences
            </h2>

            <div className="space-y-4">
              {/* Default Platform */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Platform
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['all', 'instagram', 'youtube', 'tiktok'] as const).map((platform) => (
                    <button
                      key={platform}
                      onClick={() => setSettings(prev => ({ ...prev, defaultPlatform: platform }))}
                      className={`px-4 py-2 rounded-lg font-medium text-sm capitalize transition-all ${
                        settings.defaultPlatform === platform
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Tone */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Content Tone
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['casual', 'professional', 'hype'] as const).map((tone) => (
                    <button
                      key={tone}
                      onClick={() => setSettings(prev => ({ ...prev, contentTone: tone }))}
                      className={`px-4 py-2 rounded-lg font-medium text-sm capitalize transition-all ${
                        settings.contentTone === tone
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Affects the style of AI-generated content
                </p>
              </div>
            </div>
          </div>

          {/* Automation Settings */}
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Database className="text-blue-400" />
              Automation
            </h2>

            <div className="space-y-4">
              {/* Auto Schedule Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">Auto-Schedule Episodes</div>
                  <div className="text-sm text-gray-400">Automatically predict future episode dates</div>
                </div>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, autoScheduleEnabled: !prev.autoScheduleEnabled }))}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    settings.autoScheduleEnabled ? 'bg-purple-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${
                      settings.autoScheduleEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Notifications Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">Schedule Change Alerts</div>
                  <div className="text-sm text-gray-400">Get notified when anime schedules change</div>
                </div>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, notificationsEnabled: !prev.notificationsEnabled }))}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    settings.notificationsEnabled ? 'bg-purple-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${
                      settings.notificationsEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
            <Shield className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-yellow-200">Security Note</div>
              <div className="text-sm text-yellow-300/70">
                API keys are stored locally in your browser. Never share your keys with anyone.
                For production use, consider using environment variables on a secure backend.
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-semibold text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 shadow-lg transition-all"
            >
              {saved ? (
                <>
                  <CheckCircle size={20} />
                  Saved!
                </>
              ) : (
                <>
                  <Save size={20} />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
