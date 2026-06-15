import { useNavigate } from 'react-router-dom'

const LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/sg-as-price-list.firebasestorage.app/o/Screenshot%202026-02-04%20021131.png?alt=media'

const tools = [
  {
    route: '/crd',
    label: 'CRD Generator',
    abbr: 'CRD',
    description: 'Turn raw client notes and meeting documents into structured Client Request Documents.',
    cta: 'Open CRD Generator',
    accent: 'blue',
  },
  {
    route: '/brd',
    label: 'BRD Generator',
    abbr: 'BRD',
    description: 'Group client requirements into platform-level Business Requirements Documents.',
    cta: 'Open BRD Generator',
    accent: 'violet',
  },
  {
    route: '/ird',
    label: 'IRD Generator',
    abbr: 'IRD',
    description: 'Document internal operational needs, team requirements, and process constraints.',
    cta: 'Open IRD Generator',
    accent: 'emerald',
  },
  {
    route: '/prd',
    label: 'PRD Generator',
    abbr: 'PRD',
    description: 'Outline product features, user stories, and technical specifications.',
    cta: 'Open PRD Generator',
    accent: 'orange',
  },
]

const accentClasses = {
  blue: {
    abbr: 'bg-blue-50 text-blue-700 border-blue-100',
    hover: 'group-hover:border-blue-300',
    arrow: 'text-blue-500 group-hover:text-blue-600',
    cta: 'text-blue-600 group-hover:text-blue-700',
  },
  violet: {
    abbr: 'bg-violet-50 text-violet-700 border-violet-100',
    hover: 'group-hover:border-violet-300',
    arrow: 'text-violet-400 group-hover:text-violet-600',
    cta: 'text-violet-600 group-hover:text-violet-700',
  },
  emerald: {
    abbr: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    hover: 'group-hover:border-emerald-300',
    arrow: 'text-emerald-400 group-hover:text-emerald-600',
    cta: 'text-emerald-600 group-hover:text-emerald-700',
  },
  orange: {
    abbr: 'bg-orange-50 text-orange-700 border-orange-100',
    hover: 'group-hover:border-orange-300',
    arrow: 'text-orange-400 group-hover:text-orange-600',
    cta: 'text-orange-600 group-hover:text-orange-700',
  },
}

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50/50 font-sans">
      <header className="w-full bg-white border-b border-zinc-200">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 h-16 flex items-center">
          <div className="flex items-center gap-4">
            <div className="bg-white p-1.5 rounded-lg border border-zinc-100 shadow-sm overflow-hidden flex items-center justify-center">
              <img src={LOGO_URL} alt="Allocate Space Logo" className="h-8 w-auto object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-zinc-900">Allocate Space</span>
              <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">AI Assisted Generator</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Document Generator</h1>
          <p className="text-sm text-zinc-500">Choose a tool to get started</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
          {tools.map(tool => {
            const ac = accentClasses[tool.accent]
            return (
              <button
                key={tool.route}
                onClick={() => navigate(tool.route)}
                className={`group text-left bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm transition-all duration-150 hover:shadow-md ${ac.hover} focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2`}
              >
                <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded border mb-4 ${ac.abbr}`}>
                  {tool.abbr}
                </span>
                <h2 className="text-base font-semibold text-zinc-900 mb-2">{tool.label}</h2>
                <p className="text-sm text-zinc-500 leading-relaxed mb-6">{tool.description}</p>
                <span className={`flex items-center gap-1 text-sm font-medium ${ac.cta}`}>
                  {tool.cta}
                  <svg className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${ac.arrow}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
