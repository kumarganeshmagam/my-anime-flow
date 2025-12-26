import React, { useState, useEffect } from 'react'
import {
  ArrowLeft, Copy, Trash2, Check, CheckCircle, Clock,
  Instagram, Youtube, Film, Loader, Search, Filter
} from 'lucide-react'
import { firestoreHelpers, type GeneratedContent } from '../config/firebase'

interface ContentLibraryProps {
  onBack: () => void
}

const ContentLibrary: React.FC<ContentLibraryProps> = ({ onBack }) => {
  const [content, setContent] = useState<GeneratedContent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'reel' | 'post' | 'short'>('all')
  const [filterPosted, setFilterPosted] = useState<'all' | 'posted' | 'pending'>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Load content on mount
  useEffect(() => {
    loadContent()
  }, [])

  const loadContent = async () => {
    setIsLoading(true)
    try {
      const data = await firestoreHelpers.getGeneratedContent()
      setContent(data)
    } catch (error) {
      console.error('Error loading content:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Copy content to clipboard
  const handleCopy = async (item: GeneratedContent) => {
    const textToCopy = `${item.caption}\n\n${item.hashtags.join(' ')}`
    await navigator.clipboard.writeText(textToCopy)
    setCopiedId(item.id || null)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Mark as posted
  const handleMarkPosted = async (id: string) => {
    try {
      await firestoreHelpers.markAsPosted(id)
      setContent(prev => prev.map(item =>
        item.id === id ? { ...item, posted: true } : item
      ))
    } catch (error) {
      console.error('Error marking as posted:', error)
    }
  }

  // Delete content
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this content?')) return

    try {
      await firestoreHelpers.deleteContent(id)
      setContent(prev => prev.filter(item => item.id !== id))
    } catch (error) {
      console.error('Error deleting content:', error)
    }
  }

  // Filter content
  const filteredContent = content.filter(item => {
    const matchesSearch = item.animeTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.caption.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === 'all' || item.contentType === filterType

    const matchesPosted = filterPosted === 'all' ||
      (filterPosted === 'posted' && item.posted) ||
      (filterPosted === 'pending' && !item.posted)

    return matchesSearch && matchesType && matchesPosted
  })

  // Get icon for content type
  const getTypeIcon = (type: GeneratedContent['contentType']) => {
    switch (type) {
      case 'reel':
        return <Instagram size={16} className="text-pink-400" />
      case 'short':
        return <Youtube size={16} className="text-red-400" />
      case 'post':
        return <Film size={16} className="text-blue-400" />
      default:
        return <Film size={16} className="text-gray-400" />
    }
  }

  // Format date
  const formatDate = (timestamp: { toDate: () => Date } | Date) => {
    const date = 'toDate' in timestamp ? timestamp.toDate() : timestamp
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">Content Library</h1>
              <p className="text-gray-400 mt-1">
                {content.length} pieces of generated content
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by anime title..."
                className="w-full bg-slate-800 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-500" />
              <div className="flex gap-1">
                {(['all', 'reel', 'post', 'short'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                      filterType === type
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Posted Filter */}
            <div className="flex gap-1">
              {(['all', 'pending', 'posted'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterPosted(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                    filterPosted === status
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="animate-spin text-purple-400" size={48} />
          </div>
        ) : filteredContent.length === 0 ? (
          <div className="text-center py-20">
            <Film size={64} className="mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400 text-lg">No content found</p>
            <p className="text-gray-500 text-sm mt-2">
              {content.length === 0
                ? 'Generate content from the home page'
                : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredContent.map((item) => (
              <div
                key={item.id}
                className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden hover:border-purple-500/50 transition-all"
              >
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getTypeIcon(item.contentType)}
                    <div>
                      <div className="font-semibold text-white">{item.animeTitle}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <Clock size={12} />
                        {formatDate(item.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.posted ? (
                      <span className="bg-green-600/20 text-green-400 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                        <CheckCircle size={12} />
                        Posted
                      </span>
                    ) : (
                      <span className="bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded text-xs font-medium">
                        Pending
                      </span>
                    )}
                    <span className="bg-slate-700 text-gray-300 px-2 py-1 rounded text-xs font-medium capitalize">
                      {item.platform}
                    </span>
                  </div>
                </div>

                {/* Content Preview */}
                <div className="p-4">
                  <div
                    className={`text-gray-300 text-sm whitespace-pre-wrap ${
                      expandedId === item.id ? '' : 'line-clamp-3'
                    }`}
                  >
                    {item.caption}
                  </div>
                  {item.caption.length > 200 && (
                    <button
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id || null)}
                      className="text-purple-400 hover:text-purple-300 text-sm mt-2"
                    >
                      {expandedId === item.id ? 'Show less' : 'Show more'}
                    </button>
                  )}

                  {/* Hashtags */}
                  {item.hashtags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {item.hashtags.slice(0, 5).map((tag, idx) => (
                        <span
                          key={idx}
                          className="bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.hashtags.length > 5 && (
                        <span className="text-gray-500 text-xs">
                          +{item.hashtags.length - 5} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Image Prompt Preview */}
                  {item.imagePrompt && (
                    <div className="mt-3 bg-slate-800/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Image Prompt:</div>
                      <div className="text-xs text-gray-400 line-clamp-2">
                        {item.imagePrompt}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-white/10 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopy(item)}
                      className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check size={16} className="text-green-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          Copy
                        </>
                      )}
                    </button>

                    {!item.posted && (
                      <button
                        onClick={() => handleMarkPosted(item.id!)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                      >
                        <CheckCircle size={16} />
                        Mark Posted
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(item.id!)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats Footer */}
        {content.length > 0 && (
          <div className="mt-8 bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
            <div className="flex flex-wrap items-center justify-center gap-8 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{content.length}</div>
                <div className="text-xs text-gray-500">Total Generated</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">
                  {content.filter(c => c.posted).length}
                </div>
                <div className="text-xs text-gray-500">Posted</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">
                  {content.filter(c => !c.posted).length}
                </div>
                <div className="text-xs text-gray-500">Pending</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-pink-400">
                  {content.filter(c => c.contentType === 'reel').length}
                </div>
                <div className="text-xs text-gray-500">Reels</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">
                  {content.filter(c => c.contentType === 'short').length}
                </div>
                <div className="text-xs text-gray-500">Shorts</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ContentLibrary
