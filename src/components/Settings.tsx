import React, { useState, useEffect } from 'react'
import {
  X, Key, Save, CheckCircle, AlertCircle, Eye, EyeOff,
  Database, Zap, ExternalLink, Shield
} from 'lucide-react'

interface SettingsProps {
  onClose: () => void
}

interface SettingsState {
  anthropicApiKey: string
  malClientId: string
  defaultPlatform: 'instagram' | 'youtube' | 'tiktok' | 'all'
  contentTone: 'casual' | 'professional' | 'hype'
  autoScheduleEnabled: boolean
  notificationsEnabled: boolean
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<SettingsState>({
    anthropicApiKey: '',
    malClientId: '',
    defaultPlatform: 'all',
    contentTone: 'hype',
    autoScheduleEnabled: true,
    notificationsEnabled: true
  })

  const [showApiKey, setShowApiKey] = useState(false)
  const [showMalKey, setShowMalKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testingApi, setTestingApi] = useState(false)
  const [apiStatus, setApiStatus] = useState<'untested' | 'success' | 'error'>('untested')

  // Load settings on mount
  useEffect(() => {
    const savedSettings: Partial<SettingsState> = {}

    savedSettings.anthropicApiKey = localStorage.getItem('anthropic_api_key') || ''
    savedSettings.malClientId = localStorage.getItem('mal_client_id') || ''
    savedSettings.defaultPlatform = (localStorage.getItem('default_platform') as SettingsState['defaultPlatform']) || 'all'
    savedSettings.contentTone = (localStorage.getItem('content_tone') as SettingsState['contentTone']) || 'hype'
    savedSettings.autoScheduleEnabled = localStorage.getItem('auto_schedule') !== 'false'
    savedSettings.notificationsEnabled = localStorage.getItem('notifications') !== 'false'

    setSettings(prev => ({ ...prev, ...savedSettings }))

    // Check if API key exists
    if (savedSettings.anthropicApiKey) {
      setApiStatus('untested')
    }
  }, [])

  // Save settings
  const handleSave = () => {
    localStorage.setItem('anthropic_api_key', settings.anthropicApiKey)
    localStorage.setItem('mal_client_id', settings.malClientId)
    localStorage.setItem('default_platform', settings.defaultPlatform)
    localStorage.setItem('content_tone', settings.contentTone)
    localStorage.setItem('auto_schedule', String(settings.autoScheduleEnabled))
    localStorage.setItem('notifications', String(settings.notificationsEnabled))

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Test Anthropic API connection
  const testApiConnection = async () => {
    if (!settings.anthropicApiKey) {
      setApiStatus('error')
      return
    }

    setTestingApi(true)
    setApiStatus('untested')

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
        setApiStatus('success')
      } else {
        setApiStatus('error')
      }
    } catch {
      setApiStatus('error')
    } finally {
      setTestingApi(false)
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
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Key className="text-purple-400" />
              API Keys
            </h2>

            {/* Anthropic API Key */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Anthropic API Key
                  <span className="text-red-400 ml-1">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={settings.anthropicApiKey}
                      onChange={(e) => setSettings(prev => ({ ...prev, anthropicApiKey: e.target.value }))}
                      placeholder="sk-ant-..."
                      className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 pr-10"
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <button
                    onClick={testApiConnection}
                    disabled={testingApi || !settings.anthropicApiKey}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                  >
                    {testingApi ? (
                      <span className="animate-spin">...</span>
                    ) : apiStatus === 'success' ? (
                      <CheckCircle size={18} className="text-green-400" />
                    ) : apiStatus === 'error' ? (
                      <AlertCircle size={18} className="text-red-400" />
                    ) : (
                      <Zap size={18} />
                    )}
                    Test
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Required for AI content generation.{' '}
                  <a
                    href="https://console.anthropic.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-1"
                  >
                    Get your key <ExternalLink size={12} />
                  </a>
                </p>
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
