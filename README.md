# MRI Depression Detection 🧠🔍

Web application for **AI-based Major Depressive Disorder (MDD) detection from 3D brain MRI scans**, with an explainable heatmap that shows which brain regions drove the prediction.

> Graduation project — BSc Computer Science (AI Track), King Khalid University.

🌍 **Live demo:** [mri-depression-detection.vercel.app](https://mri-depression-detection.vercel.app) · 📓 **Training notebook:** [Colab](https://colab.research.google.com/drive/1TPpZR6kNmR0xnFOe9GZkL1iLTMxfgDuK)

## Results

Evaluated on an independent test set of 217 subjects:

| Accuracy | AUC | Sensitivity | Specificity |
|:---:|:---:|:---:|:---:|
| **96.8%** | **0.994** | 94.4% | 100% |

## Features

- 🖼️ **3D MRI upload** — accepts NIfTI scans (`.nii` / `.nii.gz`) together with basic clinical data.
- 🤖 **Multimodal AI analysis** — a 3D CNN with squeeze-and-excitation attention fused with a clinical-data encoder (sex, age, education, HAMD score).
- 🔥 **Explainable results** — 3D Grad-CAM heatmap overlaid on the scan in an interactive viewer ([NiiVue](https://github.com/niivue/niivue)).
- 📊 **Clear dashboard** — diagnosis and confidence score at a glance.

## Architecture

```
┌──────────────────────────┐      POST /api/analyze      ┌─────────────────────────────────┐
│  Next.js frontend        │  ───────────────────────►   │  FastAPI backend (PyTorch)      │
│  upload · NiiVue viewer  │  ◄───────────────────────   │  3D CNN + SE + clinical fusion  │
└──────────────────────────┘  diagnosis, confidence,     │  3D Grad-CAM heatmap            │
                              heatmap (NIfTI)            └─────────────────────────────────┘
```

The backend (model, inference and Grad-CAM) lives in [mdd-detection-backend](https://github.com/Ibrahim-Hurubi/mdd-detection-backend).

## Tech stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, NiiVue
- **AI backend:** PyTorch, MONAI, NiBabel, FastAPI
- **Deployment:** Vercel (frontend), Docker

## Run locally

```bash
git clone https://github.com/Ibrahim-Hurubi/mri-depression-detection.git
cd mri-depression-detection
npm install
npm run dev        # http://localhost:3000
```

On localhost the app calls the backend at `http://localhost:8000/api/analyze` (see the backend repo). To point it elsewhere, set `NEXT_PUBLIC_API_URL` to the full endpoint URL.

## ⚠️ Disclaimer

This is a research and educational project. It is **not** a medical device and must not be used for clinical diagnosis.

## Team

Fahad Al Nahi · **Ibrahim Hurubi** ([LinkedIn](https://www.linkedin.com/in/Ibrahim-Hurubi) · [X](https://x.com/Ibrahim_Hurubi)) · Fahad Al-Mubarak · Abdullah Alshaharani · Ali Muyini

Supervised by **Dr. Mohamed Ghouse**, Department of Computer Science, King Khalid University.
