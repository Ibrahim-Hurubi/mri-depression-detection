# MRI Depression Detection 🧠🔍

End-to-end system for **AI-based Major Depressive Disorder (MDD) detection from 3D brain MRI and clinical data** — from model training to a deployed web app with explainable heatmaps.

> Graduation project — BSc Computer Science (AI Track), King Khalid University.

🌍 **Live demo:** [mri-depression-detection.vercel.app](https://mri-depression-detection.vercel.app) · 📓 **Training notebook:** [Colab](https://colab.research.google.com/drive/1TPpZR6kNmR0xnFOe9GZkL1iLTMxfgDuK) · 📄 **Docs:** [Report](docs/MRI_Depression_Detection_Report.pdf) · [Presentation](docs/MRI_Depression_Detection_Presentation.pdf) · [Poster](docs/MRI_Depression_Detection_Poster.pdf)

## Results

Evaluated on an independent test set of 217 subjects:

| Accuracy | AUC | Sensitivity | Specificity | F1 (macro) |
|:---:|:---:|:---:|:---:|:---:|
| **96.8%** | **0.994** | 94.4% | 100% | 0.97 |

<p align="center"><img src="docs/images/roc_curve.png" width="480" alt="ROC curve on the test set (AUC 0.9943)"></p>

## Repository structure

```
├── app/, components/, hooks/, lib/   Next.js web app (deployed on Vercel)
├── backend/                          FastAPI + PyTorch inference API, trained weights, Dockerfile
├── notebooks/                        Full training pipeline (Colab, A100)
└── docs/                             Project report, presentation, poster and figures
```

## Features

- 🖼️ **3D MRI upload** — accepts NIfTI scans (`.nii` / `.nii.gz`) together with basic clinical data.
- 🤖 **Multimodal AI analysis** — a 3D CNN with squeeze-and-excitation attention fused with a clinical-data encoder (sex, age, education, HAMD score).
- 🔥 **Explainable results** — 3D Grad-CAM heatmap overlaid on the scan in an interactive viewer ([NiiVue](https://github.com/niivue/niivue)).
- 📊 **Clear dashboard** — diagnosis and confidence score at a glance.

## How it works

```
┌──────────────────────────┐      POST /api/analyze      ┌─────────────────────────────────┐
│  Next.js frontend        │  ───────────────────────►   │  FastAPI backend (PyTorch)      │
│  upload · NiiVue viewer  │  ◄───────────────────────   │  3D CNN + SE + clinical fusion  │
└──────────────────────────┘  diagnosis, confidence,     │  3D Grad-CAM heatmap            │
                              heatmap (NIfTI)            └─────────────────────────────────┘
```

**Training pipeline** ([notebook](notebooks/MDD_Training_Pipeline.ipynb)):

1. **Data engineering** — fuse 3D gray-matter MRI maps (MNI152 space) with clinical metadata, stratified 80 / 10 / 10 split (1,732 / 217 / 217), normalisation fitted on the training set only.
2. **Normative pretraining** — a 3D convolutional autoencoder learns healthy brain anatomy from Healthy Control scans; its encoder initialises the classifier.
3. **Multimodal training** — 60 epochs with multimodal MixUp, label smoothing, focal loss, AdamW, gradient clipping and cosine-annealing LR.
4. **Evaluation** — confusion matrix, ROC/AUC, sensitivity and specificity on the held-out test set.

See [`backend/README.md`](backend/README.md) for the model architecture and API details.

## Tech stack

- **AI / training:** PyTorch, MONAI, NiBabel, scikit-learn, Google Colab (A100)
- **Backend:** FastAPI, Uvicorn, Docker
- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, NiiVue
- **Deployment:** Vercel

## Run locally

```bash
git clone https://github.com/Ibrahim-Hurubi/mri-depression-detection.git
cd mri-depression-detection

# Backend (http://localhost:8000)
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py

# Frontend (http://localhost:3000), in a second terminal from the repo root
npm install
npm run dev
```

On localhost the frontend calls `http://localhost:8000/api/analyze`. To point it elsewhere, set `NEXT_PUBLIC_API_URL` to the full endpoint URL.

## ⚠️ Disclaimer

This is a research and educational project. It is **not** a medical device and must not be used for clinical diagnosis.

## Team

[Fahad Al-Nahi](https://github.com/Skkinner) · **[Ibrahim Hurubi](https://github.com/Ibrahim-Hurubi)** ([LinkedIn](https://www.linkedin.com/in/Ibrahim-Hurubi) · [X](https://x.com/Ibrahim_Hurubi)) · [Fahad Al-Mubarak](https://github.com/impx6f) · [Abdullah AlShaharani](https://github.com/st1iv) · [Ali Muyini](https://github.com/AliAhmed3140)

Supervised by **Dr. Mohamed Ghouse**, Department of Computer Science, King Khalid University.

## License

Released under the [MIT License](LICENSE).
