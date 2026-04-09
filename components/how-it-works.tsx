import { Upload, ShieldCheck, Cpu, FileText } from "lucide-react"

const steps = [
  {
    icon: Upload,
    title: "Upload",
    description: "Upload a structural T1-weighted brain MRI scan.",
  },
  {
    icon: ShieldCheck,
    title: "Preprocess",
    description: "System verifies the NIfTI format and standardizes the volumetric data to 96x96x96.",
  },
  {
    icon: Cpu,
    title: "Analyze",
    description: "The 3D-ResNet18 engine extracts spatial hierarchies and clinical biomarkers.",
  },
  {
    icon: FileText,
    title: "Interpret",
    description: "Review the diagnosis, confidence score, and Grad-CAM interpretability heatmap.",
  },
]

export function HowItWorks() {
  return (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold text-center mb-12">How The Brain Mill Works</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={step.title} className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <step.icon className="w-7 h-7 text-primary" />
                </div>
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">
                  {index + 1}
                </span>
              </div>
              <h3 className="font-medium mb-1">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
