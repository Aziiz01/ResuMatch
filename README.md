# ResuMatch

**ResuMatch** is a web application that compares your résumé with a job description: it surfaces skill overlap, suggests CV improvements with help from Hugging Face models, and includes a **LaTeX CV builder** with live HTML preview (for quick checks in the browser) and `.tex` download for local compilation.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)

## Features

- **Résumé & job input** — Paste text or upload files (PDF/DOCX supported for résumé extraction where applicable).
- **Skill match** — Extracts skills from the job description and scores how your résumé covers them (keyword matching plus optional **semantic similarity** via Hugging Face embeddings when configured).
- **Unified CV suggestion** — One block of tailored improvement notes aligned with the role.
- **LaTeX CV** — Generate LaTeX from your materials, edit in-app, preview with [LaTeX.js](https://github.com/michael-brade/LaTeX.js) in the browser, and download `.tex` or preview HTML. Full TeX features are best verified with **pdflatex** / **xelatex** locally.
- **Light / dark theme** — Toggle with smooth transitions (`next-themes`).

## Tech stack

- [Next.js](https://nextjs.org/) (App Router), React 19, TypeScript  
- [Tailwind CSS](https://tailwindcss.com/) v4  
- [Framer Motion](https://www.framer.com/motion/)  
- [Hugging Face Inference](https://huggingface.co/docs/api-inference) (`@huggingface/inference` + server routes)

## Prerequisites

- **Node.js** 20+ (LTS recommended)  
- A **Hugging Face** account and [access token](https://huggingface.co/settings/tokens) for Inference API calls (embeddings and text generation)

## Setup

```bash
git clone https://github.com/Aziiz01/ResuMatch.git
cd ResuMatch
npm install
```

Copy the environment template and add your token:

```bash
copy .env.example .env.local
```

On macOS/Linux:

```bash
cp .env.example .env.local
```

Edit `.env.local` and set `HF_TOKEN`. Optional variables are documented in `.env.example`.

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm run dev`  | Development server       |
| `npm run build`| Production build         |
| `npm run start`| Run production server    |
| `npm run lint` | ESLint                   |

Open [http://localhost:3000](http://localhost:3000) after `npm run dev`.

## Configuration

- **`HF_TOKEN`** (required for API features) — Hugging Face token with access to [Inference Providers](https://huggingface.co/settings/inference-providers).
- **`HF_EMBEDDINGS_MODEL`** — Optional. If unset, `/api/embeddings` tries in order: **BGE-large-en-v1.5**, **E5-large-v2**, **all-mpnet-base-v2** (strong defaults for semantic skill matching).
- **`HF_GENERATE_MODEL`** — Optional. If unset, `/api/generate` tries in order: **`meta-llama/Llama-3.1-8B-Instruct`**, **`Qwen/Qwen2.5-7B-Instruct`**, **`mistralai/Mistral-7B-Instruct-v0.3`** (longer completions, better for CV/LaTeX text).

Some models (e.g. Llama) are **gated**: visit the model page on Hugging Face and accept the license while logged in, then reuse the same token.

Do not commit `.env.local` or real tokens. The repository includes `.env.example` only as a template.

## Project layout (high level)

- `src/app/` — App Router pages and API routes (`/api/embeddings`, `/api/generate`)  
- `src/components/` — UI (dashboard, inputs, skill match, suggestions, LaTeX panel, theme)  
- `src/lib/` — Skills, matching, résumé extraction, prompts  

## License

Copyright © 2026 **Mohamed Aziz Nacib**. See [LICENSE](./LICENSE).

## Author

**Mohamed Aziz Nacib**

Repository: [https://github.com/Aziiz01/ResuMatch](https://github.com/Aziiz01/ResuMatch)
