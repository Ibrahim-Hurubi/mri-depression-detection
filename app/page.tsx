import { MRIAnalyzer } from "@/components/mri-analyzer"
import { HowItWorks } from "@/components/how-it-works"
import { Brain } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10">
              <Brain className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">
              Deep Learning Based Depression Detection from Brain MRI
            </h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto text-pretty">
              Upload your brain MRI scan for AI-powered analysis using deep learning models.
            </p>
          </div>

          {/* MRI Analyzer (Upload + Button) */}
          <MRIAnalyzer />
        </div>
      </main>

      {/* How It Works - Bottom */}
      <HowItWorks />

      <footer className="py-6 px-6 border-t border-border">
        <p className="text-center text-xs text-muted-foreground">
          Research Tool - For educational and research purposes only
        </p>
      </footer>
    </div>
  )
}