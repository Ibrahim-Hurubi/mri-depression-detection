"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useDropzone } from "react-dropzone"
import {
  Upload,
  Brain,
  Trash2,
  AlertCircle,
  CheckCircle,
  RefreshCcw,
  FileImage,
  Layers,
  Activity,
  Search,
  User,
  GraduationCap,
  ClipboardList,
  Fingerprint
} from "lucide-react"

// Import UI components from the project library (ensure these match your actual paths)
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
  prediction: "Normal Brain Structure" | "Depression Signs Detected" | string
  confidence: number
}

// Medical imaging formats we support in this project
const SUPPORTED_EXTENSIONS = [".nii", ".nii.gz"]

// List of clinical steps updated for Multimodal Model
const PROCESSING_STEPS = [
  { text: "Initializing secure medical environment...", limit: 10 },
  { text: "Loading 3D NIfTI volume into memory...", limit: 20 },
  { text: "Fusing Clinical Metadata with MRI Features...", limit: 35 },
  { text: "Normalizing 3D Volume to 64x64x64...", limit: 50 },
  { text: "Executing SOTA Multimodal Fusion Network...", limit: 65 },
  { text: "Calculating SE-Attention activation maps...", limit: 80 },
  { text: "Computing Grad-CAM explainability...", limit: 90 },
  { text: "Finalizing diagnostic clinical report...", limit: 99 },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isValidFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return SUPPORTED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

export function MRIAnalyzer() {
  const [state, setState] = useState<AnalyzerState>("upload")
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [processingStep, setProcessingStep] = useState("")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  
  // Clinical Data States
  const [clinicalData, setClinicalData] = useState({
    age: "30",
    sex: "1", // 1 for Male, 0 for Female
    edu: "16",
    hamd: "15"
  });

  const [isProcessing, setIsProcessing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nvRef = useRef<any>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setClinicalData(prev => ({ ...prev, [name]: value }));
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null); 
    setApiError(null);
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    if (!isValidFile(file.name)) {
      setError("Invalid format. Please upload .nii or .nii.gz MRI files only.");
      return;
    }
    setFileInfo({ name: file.name, size: file.size, file });
    setState("file-loaded");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  });

  const removeFile = () => {
    setFileInfo(null); 
    setState("upload"); 
    setError(null);
    setApiError(null); 
    setProgress(0);
    if (nvRef.current) {
        nvRef.current = null; 
    }
  }

  const changeView = (type: number) => {
    if (nvRef.current) nvRef.current.setSliceType(type);
  }

  useEffect(() => {
    if ((state === "file-loaded" || state === "processing" || state === "results") && fileInfo?.file && canvasRef.current) {
      let isMounted = true;
      const initViewer = async () => {
        try {
          const { Niivue } = await import("@niivue/niivue");
          if (!isMounted || !canvasRef.current || nvRef.current) return;
          
          const nv = new Niivue({ 
            backColor: [0.05, 0.05, 0.05, 1], 
            show3Dcrosshair: true, 
            dragAndDropEnabled: false 
          });
          
          nv.attachToCanvas(canvasRef.current);
          nvRef.current = nv;
          const url = URL.createObjectURL(fileInfo.file);
          
          await nv.loadVolumes([{ url, name: fileInfo.name }]);
          nv.setSliceType(nv.sliceTypeRender);
        } catch (err) { 
          console.error("3D Viewer failed to initialize:", err); 
        }
      };
      
      initViewer();
      
      return () => { 
        isMounted = false; 
      };
    }
  }, [state, fileInfo]);

  const handleAnalyze = async () => {
    if (!fileInfo?.file) return
    setState("processing"); 
    setIsProcessing(true); 
    setApiError(null); 
    setProgress(0);

    const formData = new FormData();
    formData.append("file", fileInfo.file);
    formData.append("age", clinicalData.age);
    formData.append("sex", clinicalData.sex);
    formData.append("edu", clinicalData.edu);
    formData.append("hamd", clinicalData.hamd);

    const getApiUrl = () => {
      if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
      if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        if (hostname === "localhost" || hostname === "127.0.0.1") return "http://localhost:8000/api/analyze";
      }
      return "https://undepressive-esmeralda-frolicsomely.ngrok-free.dev/api/analyze";
    };

    const animationInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 98) {
          setProcessingStep("Waiting for Multimodal Fusion (Zorin Server)...");
          return 98; 
        }
        const step = PROCESSING_STEPS.find(s => prev < s.limit) || PROCESSING_STEPS[7];
        setProcessingStep(step.text);
        return Math.min(prev + (prev < 40 ? 1.5 : 0.5), 98);
      });
    }, 150);

    try {
      const response = await fetch(getApiUrl(), {
        method: "POST",
        body: formData,
        headers: { "ngrok-skip-browser-warning": "true" }
      });

      if (!response.ok) throw new Error(`Server connection failed. Status: ${response.status}`);
      const data = await response.json();

      clearInterval(animationInterval);
      setProgress(100);
      setProcessingStep("Diagnostic complete.");
      await new Promise(r => setTimeout(r, 600));

      setResult({ prediction: data.diagnosis, confidence: data.confidence });

      if (data.heatmap && nvRef.current) {
        try {
          const responseBlob = await fetch(`data:application/octet-stream;base64,${data.heatmap}`).then(res => res.blob());
          const heatmapFile = new File([responseBlob], "heatmap.nii.gz");
          const heatmapUrl = URL.createObjectURL(heatmapFile);
          
          await nvRef.current.addVolumeFromUrl({ 
            url: heatmapUrl, 
            name: 'heatmap.nii.gz', 
            colormap: 'warm', 
            opacity: 0.70,          // Optimized opacity for localized hotspots
            cal_min: 0.45           // High threshold to filter sharpened background noise
          });
          nvRef.current.setSliceType(nvRef.current.sliceTypeMultiplanar);
        } catch (e) { 
          console.error("Overlay parsing error:", e); 
        }
      }
      setState("results");
    } catch (err) {
      console.error("Analysis Request Error:", err);
      clearInterval(animationInterval);
      setApiError("Network Error: Ensure Zorin Backend is running and reachable.");
      setState("file-loaded");
    } finally { 
      setIsProcessing(false); 
    }
  }

  const resetAnalyzer = () => {
    setState("upload"); 
    setFileInfo(null); 
    setError(null); 
    setApiError(null);
    setProgress(0); 
    setResult(null); 
    setIsProcessing(false);
    if (nvRef.current) {
        nvRef.current = null;
    }
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
        <>
          <Card className="overflow-hidden border-border/50 shadow-xl">
            <div className="bg-black relative aspect-video w-full flex items-center justify-center overflow-hidden border-b border-border/50">
              <canvas key={fileInfo.name} ref={canvasRef} className="w-full h-full outline-none" />
              <div className="absolute top-4 left-4 flex gap-2">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">Live MRI Stream</span>
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
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/5">
                  <FileImage className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm truncate max-w-[200px]">{fileInfo.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{formatFileSize(fileInfo.size)}</p>
                </div>
              </div>
              {state === "file-loaded" && (
                <button onClick={removeFile} className="p-2 rounded-xl bg-destructive/5 hover:bg-destructive/10 text-destructive">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </CardContent>
          </Card>

          {/* 2.5 CLINICAL DATA INPUTS */}
          {state === "file-loaded" && (
            <Card className="border-primary/20 shadow-lg animate-in slide-in-from-bottom-2 duration-300">
              <CardHeader className="py-4 border-b">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" /> Patient Clinical Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                      <Fingerprint className="w-3 h-3"/> Age
                    </label>
                    <input type="number" name="age" value={clinicalData.age} onChange={handleInputChange} 
                      className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 ring-primary/20 outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3"/> Biological Sex
                    </label>
                    <select name="sex" value={clinicalData.sex} onChange={handleInputChange}
                      className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 ring-primary/20 outline-none">
                      <option value="1">Male</option>
                      <option value="0">Female</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                      <GraduationCap className="w-3 h-3"/> Education (Yrs)
                    </label>
                    <input type="number" name="edu" value={clinicalData.edu} onChange={handleInputChange}
                      className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 ring-primary/20 outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                      <Activity className="w-3 h-3"/> HAM-D Score
                    </label>
                    <input type="number" name="hamd" value={clinicalData.hamd} onChange={handleInputChange}
                      className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 ring-primary/20 outline-none" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* 3. PROGRESS BAR */}
      {state === "processing" && (
        <Card className="border-primary/30 bg-primary/[0.02] shadow-2xl relative overflow-hidden">
          <CardContent className="p-8">
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Brain className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <div className="absolute -inset-2 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              </div>
              <div className="text-center w-full space-y-2">
                <h3 className="font-bold text-foreground tracking-tight">Multimodal Fusion Analysis</h3>
                <p className="text-[10px] text-muted-foreground italic font-mono flex items-center justify-center gap-2">
                  <Search className="w-3 h-3" /> {processingStep}
                </p>
              </div>
              <div className="w-full max-w-md space-y-2">
                <Progress value={progress} className="h-2" />
                <div className="flex justify-between text-[10px] text-muted-foreground font-bold uppercase">
                  <span>SOTA Fusion Engine</span>
                  <span>{Math.round(progress)}%</span>
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
                result.prediction.includes("Normal") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              )}>
                {result.prediction.includes("Normal") ? <CheckCircle className="w-5 h-5 mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
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
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${result.confidence * 2.63} 263`} className={result.prediction.includes("Normal") ? "text-green-500" : "text-red-500"} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-black text-foreground">{result.confidence.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Confidence Level</p>
                  <p className="text-xl font-bold">{result.confidence >= 90 ? "High Reliability" : "Moderate Confidence"}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">Calculated via multimodal fusion analysis.</p>
                </div>
              </div>
              <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
                <h4 className="text-xs font-black uppercase mb-3 flex items-center gap-2"><Layers className="w-3 h-3" /> Architecture Details</h4>
                <ul className="space-y-2">
                  <li className="text-[10px] flex justify-between"><span>Model Type:</span> <span className="font-bold">Late-Fusion Multimodal</span></li>
                  <li className="text-[10px] flex justify-between"><span>Vision Core:</span> <span className="font-bold">SE-Attention 3D CNN</span></li>
                  <li className="text-[10px] flex justify-between"><span>Interpretability:</span> <span className="font-bold">Grad-CAM Map</span></li>
                </ul>
              </div>
            </div>
            <Alert className="bg-yellow-50/50 border-yellow-100 text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-[10px] font-medium leading-normal">
                DISCLAIMER: This system is a research tool. Results must be verified by a medical specialist.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription className="text-sm font-bold">{error}</AlertDescription></Alert>}
      {apiError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription className="text-sm font-bold">{apiError}</AlertDescription></Alert>}
      
      {state === "file-loaded" && (
        <Button className="w-full h-14 text-lg font-black shadow-2xl hover:scale-[1.01] transition-all" onClick={handleAnalyze} disabled={isProcessing}>
          <Brain className="w-6 h-6 mr-3" /> RUN MULTIMODAL ANALYSIS
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
