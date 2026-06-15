import { useEffect, useRef } from 'react'

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XSmallIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export default function Toast({ message, link, linkLabel = 'Open', onDismiss }) {
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    const t = setTimeout(() => dismissRef.current(), 5000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-gray-900 text-white text-sm rounded-xl shadow-2xl max-w-sm">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
        <CheckIcon className="w-3 h-3 text-white" />
      </span>
      <span className="flex-1 leading-snug">{message}</span>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-xs text-blue-300 hover:text-blue-200 underline whitespace-nowrap"
        >
          {linkLabel}
        </a>
      )}
      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
      >
        <XSmallIcon className="w-4 h-4" />
      </button>
    </div>
  )
}
