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

// Import UI components from the local library
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

// Defining the possible states for our application flow
type AnalyzerState = "upload" | "file-loaded" | "processing" | "results"

// Interface to structure the file information we handle
interface FileInfo {
  name: string
  size: number
  file: File
}

// Interface for the structured response coming from the FastAPI server
interface AnalysisResult {
  prediction: "Normal" | "Depression Signs Detected" | string
  confidence: number
}

// Allowed medical imaging extensions for the project
const SUPPORTED_EXTENSIONS = [".nii", ".nii.gz"]

// This array stores the clinical steps displayed during the simulation
const PROCESSING_STEPS = [
  { text: "Initializing secure medical environment...", limit: 10 },
  { text: "Loading 3D NIfTI volume into memory...", limit: 25 },
  { text: "Normalizing voxel intensities (Z-Score)...", limit: 40 },
  { text: "Executing 3D ResNet-18 Deep Learning model...", limit: 60 },
  { text: "Analyzing hippocampal and amygdala regions...", limit: 75 },
  { text: "Computing Grad-CAM heatmaps (Explainability)...", limit: 85 },
  { text: "Cross-referencing with clinical dataset...", limit: 95 },
  { text: "Finalizing diagnostic report...", limit: 99 },
]

// Convert file size from bytes to human-readable format (MB/KB)
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Check if the uploaded file has a valid medical extension
function isValidFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

export function MRIAnalyzer() {
  // Application state management
  const [state, setState] = useState<AnalyzerState>("upload")
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [processingStep, setProcessingStep] = useState("")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  
  // States for handling the asynchronous API request
  const [isProcessing, setIsProcessing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Refs to store the canvas and Niivue instance without causing re-renders
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nvRef = useRef<any>(null)

  // Function to handle the file selection via drag and drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null)
    setApiError(null)
    
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    
    // Validating file format before accepting
    if (!isValidFile(file.name)) {
      setError("Invalid format. Please upload .nii or .nii.gz MRI files only.")
      return
    }

    // Move to the next state once file is accepted
    setFileInfo({ name: file.name, size: file.size, file })
    setState("file-loaded")
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  })

  // Reset the component to its initial upload state
  const removeFile = () => {
    setFileInfo(null)
    setState("upload")
    setError(null)
    setApiError(null)
    setProgress(0)
    
    // Dispose the viewer instance
    if (nvRef.current) {
      nvRef.current = null
    }
  }

  // Change the slice view (e.g., Axial to Coronal or 3D)
  const changeView = (type: number) => {
    if (nvRef.current) {
      nvRef.current.setSliceType(type)
    }
  }

  // Effect to initialize the 3D Niivue viewer when the canvas is mounted
  useEffect(() => {
    if ((state === "file-loaded" || state === "processing" || state === "results") && fileInfo?.file && canvasRef.current) {
      let isMounted = true;
      
      const initViewer = async () => {
        try {
          // Dynamic import to support client-side rendering
          const { Niivue } = await import("@niivue/niivue");
          
          if (!isMounted || !canvasRef.current || nvRef.current) return;

          // Configure the Niivue viewer settings
          const nv = new Niivue({
            backColor: [0.05, 0.05, 0.05, 1],
            show3Dcrosshair: true,
            dragAndDropEnabled: false
          });

          nv.attachToCanvas(canvasRef.current);
          nvRef.current = nv;

          // Create a temporary URL for the local file and load it
          const url = URL.createObjectURL(fileInfo.file);
          await nv.loadVolumes([{ url, name: fileInfo.name }]);
          
          // Set initial view to 3D rendering
          nv.setSliceType(nv.sliceTypeRender);
          
        } catch (err) {
          console.error("3D Viewer failed to load:", err);
        }
      };
      
      initViewer();
      
      // Cleanup to prevent memory leaks when component unmounts
      return () => { isMounted = false; };
    }
  }, [state, fileInfo]);

  // Main function that handles the deep learning analysis request
  const handleAnalyze = async () => {
    if (!fileInfo?.file) return

    setState("processing")
    setIsProcessing(true)
    setApiError(null)
    setProgress(0)

    const formData = new FormData()
    formData.append("file", fileInfo.file)

    // Parallel animation to simulate the progress bar realistically
    const animationInterval = setInterval(() => {
      setProgress(prev => {
        // Hold at 98% until the actual response is received
        if (prev >= 98) return 98; 

        // Update the label text based on current percentage
        const step = PROCESSING_STEPS.find(s => prev < s.limit) || PROCESSING_STEPS[7];
        setProcessingStep(step.text);

        // Variable speed simulation (slower during deep model execution)
        let increment = 0.5;
        if (prev < 30) increment = 1.2; 
        else if (prev > 60 && prev < 85) increment = 0.15; 
        
        return Math.min(prev + increment, 98);
      });
    }, 120);

    try {
      // Connect to the local server via the Ngrok tunnel
      const API_ENDPOINT = "https://undepressive-esmeralda-frolicsomely.ngrok-free.dev/api/analyze"
      
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        body: formData,
        headers: { 
          "ngrok-skip-browser-warning": "true" 
        }
      });

      if (!response.ok) {
        throw new Error("Could not connect to the analysis server.");
      }
      
      const data = await response.json();

      // Clear the interval and finish the progress bar
      clearInterval(animationInterval);
      setProgress(100);
      setProcessingStep("Analysis complete. Loading heatmap...");
      
      // Delay results screen for better user experience
      await new Promise(r => setTimeout(r, 800));

      setResult({
        prediction: data.diagnosis || "Normal", 
        confidence: data.confidence || 0,
      });

      // Handle the heatmap overlay returned by the server
      if (data.heatmap && nvRef.current) {
        try {
          // Decoding base64 data to reconstruct the NIfTI heatmap file
          const byteCharacters = atob(data.heatmap);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const heatmapFile = new File([byteArray], "heatmap.nii.gz", { type: 'application/octet-stream' });
          const heatmapUrl = URL.createObjectURL(heatmapFile);

          // Add the heatmap as a transparent layer over the original MRI
          await nvRef.current.addVolumeFromUrl({
            url: heatmapUrl,
            name: 'heatmap.nii.gz',
            colormap: 'warm',    
            opacity: 0.55,       
            cal_min: 0.35,       
            cal_max: 1.0
          });
          
          // Switch to multi-slice view to let the user see the internal heatmap
          nvRef.current.setSliceType(nvRef.current.sliceTypeMultiplanar);
          
        } catch (e) { 
          console.error("Heatmap overlay error:", e); 
        }
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

  // Clear all states for a new analysis session
  const resetAnalyzer = () => {
    setState("upload"); 
    setFileInfo(null); 
    setError(null); 
    setApiError(null);
    setProgress(0); 
    setProcessingStep(""); 
    setResult(null); 
    setIsProcessing(false);
    
    if (nvRef.current) {
      nvRef.current = null;
    }
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-10">
      
      {/* SECTION 1: INITIAL FILE UPLOAD */}
      {state === "upload" && (
        <Card className="border-2 border-dashed border-border hover:border-primary/40 transition-all">
          <CardContent className="p-0">
            <div 
              {...getRootProps()} 
              className={cn("flex flex-col items-center justify-center py-12 px-6 cursor-pointer", isDragActive && "bg-primary/5")}
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <p className="font-semibold text-foreground text-lg mb-1">Upload Brain MRI Scan</p>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">Drag and drop NIfTI files (.nii, .nii.gz)</p>
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

      {/* SECTION 2: THE MEDICAL 3D VIEWER CONTAINER */}
      {(state === "file-loaded" || state === "processing" || state === "results") && fileInfo && (
        <Card className="overflow-hidden border-border/50 shadow-xl">
          <div className="bg-black relative aspect-video w-full flex items-center justify-center overflow-hidden border-b border-border/50 shadow-inner">
            {/* The actual Niivue canvas */}
            <canvas ref={canvasRef} className="w-full h-full outline-none" />
            
            {/* Live stream status indicator */}
            <div className="absolute top-4 left-4 flex gap-2">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Live MRI Stream</span>
              </div>
            </div>

            {/* Viewer control buttons */}
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

          {/* File details bar */}
          <CardContent className="p-4 bg-muted/10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileImage className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-foreground text-sm truncate max-w-[250px]">{fileInfo.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                  <span>{formatFileSize(fileInfo.size)}</span>
                  <span>•</span>
                  <span>NIfTI Volume</span>
                </div>
              </div>
            </div>
            
            {/* Delete button only shown before analysis starts */}
            {state === "file-loaded" && (
              <button 
                onClick={removeFile} 
                className="p-2.5 rounded-xl bg-destructive/5 hover:bg-destructive/10 text-destructive border border-destructive/10"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* SECTION 3: LOADING BAR WITH REALISTIC STEPS */}
      {state === "processing" && (
        <Card className="border-primary/30 bg-primary/[0.02] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary/10">
            <div className="h-full bg-primary animate-progress-flow" style={{ width: '30%' }} />
          </div>
          <CardContent className="p-8">
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Brain className="w-10 h-10 text-primary animate-pulse" />
                </div>
                <div className="absolute -inset-2 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              </div>

              <div className="text-center w-full space-y-2">
                <h3 className="font-bold text-lg text-foreground tracking-tight">Neural Analysis in Progress</h3>
                <p className="text-xs text-muted-foreground italic h-5 flex items-center justify-center gap-2">
                  <Search className="w-3 h-3" /> {processingStep}
                </p>
              </div>

              <div className="w-full max-w-md space-y-2">
                <Progress value={progress} className="h-3 shadow-inner" />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono font-bold uppercase">
                  <span>Inference Engine: 3D-ResNet-18</span>
                  <span>{Math.round(progress)}% Complete</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 4: DIAGNOSTIC RESULTS SUMMARY */}
      {state === "results" && result && (
        <Card className="border-primary/30 shadow-2xl overflow-hidden animate-in fade-in duration-500">
          <CardHeader className="p-5 bg-primary/[0.03] border-b border-primary/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Brain className="w-5 h-5 text-primary" /></div>
                <CardTitle className="text-xl font-black text-foreground">AI Diagnostic Result</CardTitle>
              </div>
              <div className={cn(
                "inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-black shadow-lg",
                result.prediction === "Normal" 
                  ? "bg-green-100 text-green-700" 
                  : "bg-red-100 text-red-700"
              )}>
                {result.prediction === "Normal" ? (
                  <CheckCircle className="w-5 h-5 mr-2" />
                ) : (
                  <AlertCircle className="w-5 h-5 mr-2" />
                )}
                {result.prediction}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              
              {/* Circular confidence chart */}
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
                    <circle 
                      cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" 
                      strokeLinecap="round" 
                      strokeDasharray={`${result.confidence * 2.63} 263`} 
                      className={result.prediction === "Normal" ? "text-green-500" : "text-red-500"} 
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-black text-foreground">{result.confidence.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Confidence Score</p>
                  <p className="text-xl font-bold">{result.confidence >= 90 ? "High Reliability" : "Moderate Confidence"}</p>
                  <p className="text-xs text-muted-foreground">Analysis based on extracted deep learning biomarkers.</p>
                </div>
              </div>
              
              {/* Box for technical architecture info */}
              <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                <h4 className="text-xs font-black uppercase mb-3 flex items-center gap-2">
                  <Layers className="w-3 h-3" /> Technical Specs
                </h4>
                <ul className="space-y-2">
                  <li className="text-[10px] flex justify-between"><span>Base Model:</span> <span className="font-bold font-mono">3D ResNet-18</span></li>
                  <li className="text-[10px] flex justify-between"><span>Input Shape:</span> <span className="font-bold font-mono">1x128x128x128</span></li>
                  <li className="text-[10px] flex justify-between"><span>Feature Mapping:</span> <span className="font-bold font-mono">Grad-CAM Overlay</span></li>
                </ul>
              </div>
            </div>

            {/* Medical disclaimer */}
            <Alert className="bg-yellow-50/50 border-yellow-100 text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-[10px] font-medium">
                DISCLAIMER: This report is generated by an AI model for research purposes. A clinical diagnosis should only be made by a specialist.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* ERROR HANDLING UI */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm font-bold">{error}</AlertDescription>
        </Alert>
      )}
      {apiError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm font-bold">{apiError}</AlertDescription>
        </Alert>
      )}
      
      {/* FINAL ACTION BUTTONS */}
      {state === "file-loaded" && (
        <Button 
          className="w-full h-14 text-lg font-black shadow-2xl transition-all" 
          onClick={handleAnalyze} 
          disabled={isProcessing}
        >
          <Brain className="w-6 h-6 mr-3" /> RUN NEURAL ANALYSIS
        </Button>
      )}

      {state === "results" && (
        <Button 
          variant="outline" 
          className="w-full h-14 text-base font-bold border-primary/20" 
          onClick={resetAnalyzer}
        >
          <RefreshCcw className="w-5 h-5 mr-2" /> NEW PATIENT ANALYSIS
        </Button>
      )}
    </div>
  )
}
