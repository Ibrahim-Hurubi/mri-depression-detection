"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useDropzone } from "react-dropzone"
import {
  Upload,
  Brain,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCcw,
  FileImage,
  Maximize,
  Layers,
  Activity,
  Search
} from "lucide-react"

// Import UI components from the project library
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

// Defining the possible states for the app UI
type AnalyzerState = "upload" | "file-loaded" | "processing" | "results"

// Structure to save uploaded file details
interface FileInfo {
  name: string
  size: number
  file: File
}

// Structured response from our FastAPI backend
interface AnalysisResult {
  prediction: "Normal" | "Depression Signs Detected" | string
  confidence: number
}

// Medical imaging formats we support in this project
const SUPPORTED_EXTENSIONS = [".nii", ".nii.gz"]

// List of clinical steps to show during the progress simulation
const PROCESSING_STEPS = [
  { text: "Initializing secure medical environment...", limit: 10 },
  { text: "Loading 3D NIfTI volume into memory...", limit: 25 },
  { text: "Resizing and normalizing volume to 96x96x96...", limit: 40 },
  { text: "Executing 3D ResNet-18 Deep Learning model...", limit: 60 },
  { text: "Extracting deep spatial hierarchies...", limit: 75 },
  { text: "Computing Grad-CAM attention maps...", limit: 85 },
  { text: "Cross-referencing biomarker patterns...", limit: 95 },
  { text: "Finalizing diagnostic clinical report...", limit: 99 },
]

// Function to convert bytes to a readable format like MB
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Simple check for valid medical file extensions
function isValidFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

export function MRIAnalyzer() {
  // Main states for managing the workflow
  const [state, setState] = useState<AnalyzerState>("upload")
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [processingStep, setProcessingStep] = useState("")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  
  // Connection and API handling states
  const [isProcessing, setIsProcessing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Refs for the Niivue 3D canvas to avoid unnecessary re-renders
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nvRef = useRef<any>(null)

  // Logic to handle file selection or dropping
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null)
    setApiError(null)
    
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    
    // Check if file is valid before moving forward
    if (!isValidFile(file.name)) {
      setError("Invalid format. Please upload .nii or .nii.gz MRI files only.")
      return
    }

    // Save file and update state to show the viewer
    setFileInfo({ name: file.name, size: file.size, file })
    setState("file-loaded")
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  })

  // Clear current file and reset UI
  const removeFile = () => {
    setFileInfo(null)
    setState("upload")
    setError(null)
    setApiError(null)
    setProgress(0)
    
    // Clean up Niivue instance
    if (nvRef.current) {
      nvRef.current = null
    }
  }

  // View switcher (Axial, Coronal, Sagittal, or 3D)
  const changeView = (type: number) => {
    if (nvRef.current) {
      nvRef.current.setSliceType(type)
    }
  }

  // Initializing the 3D viewer when file is loaded
  useEffect(() => {
    if ((state === "file-loaded" || state === "processing" || state === "results") && fileInfo?.file && canvasRef.current) {
      let isMounted = true;
      
      const initViewer = async () => {
        try {
          const { Niivue } = await import("@niivue/niivue");
          
          if (!isMounted || !canvasRef.current || nvRef.current) return;

          // Niivue startup settings
          const nv = new Niivue({
            backColor: [0.05, 0.05, 0.05, 1],
            show3Dcrosshair: true,
            dragAndDropEnabled: false
          });

          nv.attachToCanvas(canvasRef.current);
          nvRef.current = nv;

          // Load local file into the viewer
          const url = URL.createObjectURL(fileInfo.file);
          await nv.loadVolumes([{ url, name: fileInfo.name }]);
          
          nv.setSliceType(nv.sliceTypeRender);
          
        } catch (err) {
          console.error("3D Viewer failed:", err);
        }
      };
      
      initViewer();
      return () => { isMounted = false; };
    }
  }, [state, fileInfo]);

  // Main logic to start analysis and talk to the backend
  const handleAnalyze = async () => {
    if (!fileInfo?.file) return

    setState("processing")
    setIsProcessing(true)
    setApiError(null)
    setProgress(0)

    const formData = new FormData()
    formData.append("file", fileInfo.file)

    // 🔥 SMART API SELECTION: Automatically switches between Local and Online (Ngrok)
    const getApiUrl = () => {
      if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        // If we are on localhost (my Zorin laptop), use the fast direct link
        if (hostname === "localhost" || hostname === "127.0.0.1") {
          return "http://127.0.0.1:8000/api/analyze";
        }
      }
      // Use Ngrok tunnel for external access (Doctor's devices)
      return "https://undepressive-esmeralda-frolicsomely.ngrok-free.dev/api/analyze";
    };

    const API_ENDPOINT = getApiUrl();

    // Progress bar simulation (Faster and more responsive)
    const animationInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 98) {
          // If stuck at 98%, show that we are waiting for the server
          setProcessingStep("Processing on server (Zorin OS)... Please wait.");
          return 98; 
        }

        const step = PROCESSING_STEPS.find(s => prev < s.limit) || PROCESSING_STEPS[7];
        setProcessingStep(step.text);

        // Faster speed to keep the flow smooth
        let increment = 1.0; 
        if (prev < 40) increment = 2.0; // Quick start
        else if (prev > 80) increment = 0.4; // Slow down near the end
        
        return Math.min(prev + increment, 98);
      });
    }, 100);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        body: formData,
        headers: { "ngrok-skip-browser-warning": "true" }
      });

      if (!response.ok) throw new Error("Connection failed. Check if server is running.");
      const data = await response.json();

      // Finish progress once we get the real data
      clearInterval(animationInterval);
      setProgress(100);
      setProcessingStep("Analysis complete. Generating heatmaps...");
      
      await new Promise(r => setTimeout(r, 600));

      setResult({
        prediction: data.diagnosis || "Normal", 
        confidence: data.confidence || 0,
      });

      // Loading the heatmap overlay from the server
      if (data.heatmap && nvRef.current) {
        try {
          const byteCharacters = atob(data.heatmap);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const heatmapFile = new File([byteArray], "heatmap.nii.gz", { type: 'application/octet-stream' });
          const heatmapUrl = URL.createObjectURL(heatmapFile);

          await nvRef.current.addVolumeFromUrl({
            url: heatmapUrl,
            name: 'heatmap.nii.gz',
            colormap: 'warm',    
            opacity: 0.55,       
            cal_min: 0.35,       
            cal_max: 1.0
          });
          
          nvRef.current.setSliceType(nvRef.current.sliceTypeMultiplanar);
          
        } catch (e) { console.error("Overlay error:", e); }
      }
      
      setState("results")

    } catch (err) {
      clearInterval(animationInterval);
      setApiError(err instanceof Error ? err.message : "Network error.");
      setState("file-loaded");
    } finally {
      setIsProcessing(false);
    }
  }

  // Reset function to analyze a new scan
  const resetAnalyzer = () => {
    setState("upload"); setFileInfo(null); setError(null); setApiError(null);
    setProgress(0); setProcessingStep(""); setResult(null); setIsProcessing(false);
    if (nvRef.current) nvRef.current = null;
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-10">
      
      {/* 1. UPLOAD UI */}
      {state === "upload" && (
        <Card className="border-2 border-dashed border-border hover:border-primary/40 transition-all">
          <CardContent className="p-0">
            <div {...getRootProps()} className={cn("flex flex-col items-center justify-center py-12 px-6 cursor-pointer", isDragActive && "bg-primary/5")}>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <p className="font-semibold text-foreground text-lg mb-1">Upload Brain MRI Scan</p>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">Drag and drop medical NIfTI files</p>
              <div className="flex gap-2">
                {SUPPORTED_EXTENSIONS.map((ext) => (
                  <span key={ext} className="px-3 py-1 rounded-md bg-muted text-muted-foreground text-xs font-mono">{ext}</span>
                ))}
              </div>
              <input {...getInputProps()} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2. 3D VIEWER CONTAINER */}
      {(state === "file-loaded" || state === "processing" || state === "results") && fileInfo && (
        <Card className="overflow-hidden border-border/50 shadow-xl">
          <div className="bg-black relative aspect-video w-full flex items-center justify-center overflow-hidden border-b border-border/50 shadow-inner">
            <canvas ref={canvasRef} className="w-full h-full outline-none" />
            
            <div className="absolute top-4 left-4 flex gap-2">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Live MRI Stream</span>
              </div>
            </div>

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/80 backdrop-blur-xl p-1 rounded-xl border border-white/10 z-20">
              <button onClick={() => changeView(4)} className="px-4 py-2 text-xs font-bold text-white hover:bg-primary/20 rounded-lg">3D View</button>
              <button onClick={() => changeView(3)} className="px-4 py-2 text-xs font-bold text-white hover:bg-primary/20 rounded-lg border-x border-white/5">Multiplanar</button>
              <div className="flex gap-1 px-1">
                <button onClick={() => changeView(0)} className="p-2 text-[10px] font-bold text-white/70 hover:text-white">AXI</button>
                <button onClick={() => changeView(1)} className="p-2 text-[10px] font-bold text-white/70 hover:text-white">COR</button>
                <button onClick={() => changeView(2)} className="p-2 text-[10px] font-bold text-white/70 hover:text-white">SAG</button>
              </div>
            </div>
          </div>

          <CardContent className="p-4 bg-muted/10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/5">
                <FileImage className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-foreground text-sm truncate max-w-[250px]">{fileInfo.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{formatFileSize(fileInfo.size)} • NIfTI Volume</p>
              </div>
            </div>
            {state === "file-loaded" && (
              <button onClick={removeFile} className="p-2.5 rounded-xl bg-destructive/5 hover:bg-destructive/10 text-destructive border border-destructive/10">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. PROGRESS BAR (REALISTIC FLOW) */}
      {state === "processing" && (
        <Card className="border-primary/30 bg-primary/[0.02] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary/10">
            <div className="h-full bg-primary animate-progress-flow" style={{ width: '30%' }} />
          </div>
          <CardContent className="p-8">
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-primary/5">
                  <Brain className="w-10 h-10 text-primary animate-pulse" />
                </div>
                <div className="absolute -inset-2 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              </div>

              <div className="text-center w-full space-y-2">
                <h3 className="font-bold text-lg text-foreground tracking-tight">System Analysis in Progress</h3>
                <p className="text-xs text-muted-foreground italic font-mono h-5 flex items-center justify-center gap-2">
                  <Search className="w-3 h-3" /> {processingStep}
                </p>
              </div>

              <div className="w-full max-w-md space-y-2">
                <Progress value={progress} className="h-3 shadow-inner" />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono font-bold uppercase">
                  <span>Engine: 3D ResNet-18</span>
                  <span>{Math.round(progress)}% Processed</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. RESULTS SECTION */}
      {state === "results" && result && (
        <Card className="border-primary/30 shadow-2xl overflow-hidden animate-in fade-in duration-500">
          <CardHeader className="p-5 bg-primary/[0.03] border-b border-primary/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Brain className="w-5 h-5 text-primary" /></div>
                <CardTitle className="text-xl font-black text-foreground">AI Diagnostic Summary</CardTitle>
              </div>
              <div className={cn(
                "inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-black shadow-lg",
                result.prediction === "Normal" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              )}>
                {result.prediction === "Normal" ? <CheckCircle className="w-5 h-5 mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
                {result.prediction}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24 shrink-0 drop-shadow-xl">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${result.confidence * 2.63} 263`} className={result.prediction === "Normal" ? "text-green-500" : "text-red-500"} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-black text-foreground">{result.confidence.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Confidence Level</p>
                  <p className="text-xl font-bold">{result.confidence >= 90 ? "High Reliability" : "Moderate Confidence"}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">Calculated via deep learning volumetric analysis.</p>
                </div>
              </div>
              
              <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                <h4 className="text-xs font-black uppercase mb-3 flex items-center gap-2"><Layers className="w-3 h-3" /> Technical Specs</h4>
                <ul className="space-y-2">
                  <li className="text-[10px] flex justify-between"><span>Architecture:</span> <span className="font-bold">3D ResNet-18</span></li>
                  <li className="text-[10px] flex justify-between"><span>Target Volume:</span> <span className="font-bold">96x96x96</span></li>
                  <li className="text-[10px] flex justify-between"><span>Interpretability:</span> <span className="font-bold">Grad-CAM Overlay</span></li>
                </ul>
              </div>
            </div>

            <Alert className="bg-yellow-50/50 border-yellow-100 text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-[10px] font-medium leading-normal">
                DISCLAIMER: This system is a graduation project research tool. Results are intended for clinical exploration and must be verified by a medical specialist.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* ERROR HANDLING */}
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription className="text-sm font-bold">{error}</AlertDescription></Alert>}
      {apiError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription className="text-sm font-bold">{apiError}</AlertDescription></Alert>}
      
      {/* FINAL BUTTONS */}
      {state === "file-loaded" && (
        <Button className="w-full h-14 text-lg font-black shadow-2xl hover:scale-[1.01] active:scale-[0.99] transition-all" onClick={handleAnalyze} disabled={isProcessing}>
          <Brain className="w-6 h-6 mr-3" /> RUN DEEP LEARNING ANALYSIS
        </Button>
      )}

      {state === "results" && (
        <Button variant="outline" className="w-full h-14 text-base font-bold border-primary/20 hover:bg-primary/5 transition-all" onClick={resetAnalyzer}>
          <RefreshCcw className="w-5 h-5 mr-2" /> ANALYZE NEW PATIENT
        </Button>
      )}
    </div>
  )
}
