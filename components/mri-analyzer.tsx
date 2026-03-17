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
  Maximize
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type AnalyzerState = "upload" | "file-loaded" | "processing" | "results"

interface FileInfo {
  name: string
  size: number
  file: File
}

interface AnalysisResult {
  prediction: "Normal" | "Depression Signs Detected" | string
  confidence: number
}

const SUPPORTED_EXTENSIONS = [".nii", ".nii.gz"]

const PROCESSING_STEPS = [
  "Initializing analysis...",
  "Preprocessing MRI data...",
  "Extracting features...",
  "Running deep learning model...",
  "Generating results...",
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
  
  // API integration states
  const [isProcessing, setIsProcessing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // 3D Viewer Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nvRef = useRef<any>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null)
    setApiError(null)
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    if (!isValidFile(file.name)) {
      setError("Invalid format. Please upload medical MRI files (.nii or .nii.gz only)")
      return
    }

    setFileInfo({ name: file.name, size: file.size, file })
    setState("file-loaded")
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  })

  const removeFile = () => {
    setFileInfo(null)
    setState("upload")
    setError(null)
    setApiError(null)
    // تنظيف مكتبة الـ 3D عند حذف الملف
    if (nvRef.current) {
      nvRef.current = null
    }
  }

  // Effect لمكتبة العرض ثلاثي الأبعاد
  useEffect(() => {
    if ((state === "file-loaded" || state === "processing" || state === "results") && fileInfo?.file && canvasRef.current) {
      let isMounted = true;

      const initViewer = async () => {
        try {
          // استيراد ديناميكي
          const { Niivue } = await import("@niivue/niivue");
          
          if (!isMounted || !canvasRef.current) return;
          if (nvRef.current) return;

          const nv = new Niivue({
            dragAndDropEnabled: false,
            backColor: [0.05, 0.05, 0.05, 1],
            show3Dcrosshair: true,
          });

          nv.attachToCanvas(canvasRef.current);
          nvRef.current = nv;

          const url = URL.createObjectURL(fileInfo.file);
          
          await nv.loadVolumes([{
            url: url,
            name: fileInfo.name
          }]);

          nv.setSliceType(nv.sliceTypeRender);
          
        } catch (err) {
          console.error("Error loading 3D viewer:", err);
        }
      };

      initViewer();

      return () => {
        isMounted = false;
      };
    }
  }, [state, fileInfo]);

  // The Real API Integration
  const handleAnalyze = async () => {
    if (!fileInfo?.file) return

    setState("processing")
    setIsProcessing(true)
    setApiError(null)
    setProgress(0)

    // Prepare FormData for API
    const formData = new FormData()
    formData.append("file", fileInfo.file)

    try {
      // Simulate processing steps for UX feedback
      for (let i = 0; i < PROCESSING_STEPS.length; i++) {
        setProcessingStep(PROCESSING_STEPS[i])
        const targetProgress = ((i + 1) / PROCESSING_STEPS.length) * 100
        
        await new Promise<void>((resolve) => {
          const duration = 500
          const startProgress = (i / PROCESSING_STEPS.length) * 100
          const increment = (targetProgress - startProgress) / 10
          let step = 0
          
          const interval = setInterval(() => {
            step++
            setProgress((prev) => Math.min(prev + increment, targetProgress))
            if (step >= 10) {
              clearInterval(interval)
              resolve()
            }
          }, duration / 10)
        })
      }

      // Your Local Backend via Ngrok
      const API_ENDPOINT = "https://undepressive-esmeralda-frolicsomely.ngrok-free.dev/api/analyze"
      
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        body: formData,
        headers: {
          "ngrok-skip-browser-warning": "true",
        }
      })

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`)
      }

      // 1. Receive data from your Python backend
      const data = await response.json()
      
      // 2. Map backend response to Frontend
      setResult({
        prediction: data.diagnosis || "Normal", 
        confidence: data.confidence || 0,
      })
      
      setState("results")

    } catch (err) {
      console.error("API Error:", err)
      setApiError(err instanceof Error ? err.message : "Failed to connect to backend. Please ensure Ngrok and local server are running.")
      setState("file-loaded") 
      
    } finally {
      setIsProcessing(false)
    }
  }

  const resetAnalyzer = () => {
    setState("upload")
    setFileInfo(null)
    setError(null)
    setApiError(null)
    setProgress(0)
    setProcessingStep("")
    setResult(null)
    setIsProcessing(false)
    if (nvRef.current) {
      nvRef.current = null
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload State */}
      {state === "upload" && (
        <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-colors">
          <CardContent className="p-0">
            <div
              {...getRootProps()}
              className={cn(
                "flex flex-col items-center justify-center py-10 px-6 cursor-pointer",
                isDragActive && "bg-primary/5"
              )}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <p className="font-medium text-foreground text-sm mb-1">
                Upload Brain MRI Scan
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Drag & drop or click to browse
              </p>
              <div className="flex items-center gap-2">
                {SUPPORTED_EXTENSIONS.map((ext) => (
                  <span
                    key={ext}
                    className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs"
                  >
                    {ext}
                  </span>
                ))}
              </div>
              <input {...getInputProps()} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3D Viewer State */}
      {(state === "file-loaded" || state === "processing" || state === "results") && fileInfo && (
        <Card className="overflow-hidden border-border/50">
          <div className="bg-black/95 relative aspect-video w-full flex items-center justify-center overflow-hidden border-b border-border/50">
            <canvas ref={canvasRef} className="w-full h-full outline-none cursor-grab active:cursor-grabbing" />
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
              <Maximize className="w-4 h-4 text-white/70" />
              <span className="text-xs font-medium text-white/90">Interactive 3D View</span>
            </div>
          </div>
          <CardContent className="p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileImage className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm truncate max-w-[200px] md:max-w-[300px]">
                    {fileInfo.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(fileInfo.size)}
                  </p>
                </div>
              </div>
              {state === "file-loaded" && (
                <button
                  onClick={removeFile}
                  className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                  title="Remove file"
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing State */}
      {state === "processing" && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center space-y-5">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Brain className="w-7 h-7 text-primary animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              </div>

              <div className="text-center w-full">
                <p className="font-medium text-foreground text-sm mb-1">
                  Analyzing Brain Scan...
                </p>
                <p className="text-xs text-muted-foreground">
                  {processingStep}
                </p>
              </div>

              <div className="w-full space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  {Math.round(progress)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results State */}
      {state === "results" && result && (
        <Card className="border-primary/20 shadow-md">
          <CardHeader className="pb-3 bg-primary/5 border-b border-primary/10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Analysis Complete
              </CardTitle>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold",
                  result.prediction === "Normal"
                    ? "bg-success/20 text-success-foreground"
                    : "bg-destructive/20 text-destructive-foreground"
                )}
              >
                {result.prediction === "Normal" ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {result.prediction}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="flex items-center gap-5">
              <div className="relative w-20 h-20">
                <svg
                  className="w-full h-full -rotate-90 drop-shadow-sm"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted/30"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${result.confidence * 2.51} 251`}
                    className={
                      result.prediction === "Normal"
                        ? "text-success"
                        : "text-destructive"
                    }
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-lg font-bold text-foreground leading-none">
                    {result.confidence.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">AI Confidence Score</p>
                <p className="font-bold text-foreground text-lg">
                  {result.confidence >= 90
                    ? "Very High"
                    : result.confidence >= 75
                    ? "Moderate"
                    : "Low"}
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                  Based on deep learning feature extraction.
                </p>
              </div>
            </div>

            <Alert className="bg-muted/50 border-none">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <AlertDescription className="text-xs text-muted-foreground">
                For educational and research purposes only. Always consult a certified medical professional for an official clinical diagnosis.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Error alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {apiError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{apiError}</AlertDescription>
        </Alert>
      )}

      {/* Action buttons */}
      {state === "upload" && (
        <Button className="w-full h-12 text-base" disabled>
          <Brain className="w-5 h-5 mr-2" />
          Upload a scan to begin
        </Button>
      )}

      {state === "file-loaded" && (
        <Button className="w-full h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all" onClick={handleAnalyze} disabled={isProcessing}>
          <Brain className="w-5 h-5 mr-2" />
          Start Deep Learning Analysis
        </Button>
      )}

      {state === "processing" && (
        <Button className="w-full h-12 text-base" disabled>
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          Processing MRI Scan...
        </Button>
      )}

      {state === "results" && (
        <Button variant="outline" className="w-full h-12 text-base border-primary/20 hover:bg-primary/5" onClick={resetAnalyzer}>
          <RefreshCcw className="w-5 h-5 mr-2" />
          Analyze Another Patient Scan
        </Button>
      )}
    </div>
  )
}
