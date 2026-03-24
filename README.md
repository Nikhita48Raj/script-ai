# 🎬 Script AI

**Script AI** is a film production intelligence app for analyzing screenplay text, extracting scene-level production metadata, visualizing scene dependencies, and simulating schedule risk.

---

## 🚀 Features

✨ Parse screenplay text into scenes using `INT.` / `EXT.` scene headings
🎭 Extract scene metadata:

* Characters
* Location
* Time
* Complexity
* Risk
* Cost
* Production heuristics

🔗 Build a dependency graph between scenes
📊 Run multiple types of delay simulations:

* Single-scene
* Multi-scene
* Monte Carlo
* Worst-case

🆚 Compare two script drafts
📅 Generate schedule optimization suggestions
🎥 Explore cinematic views:

* Structure
* Storyboard
* Casting
* System graph
* Impact simulation

📖 For a detailed walkthrough, see `FEATURES.md`

---

## 📁 Project Structure

```text
script-ai/
├── backend/
│   ├── app/
│   │   ├── ai/
│   │   ├── logic/
│   │   ├── services/
│   │   ├── main.py
│   │   ├── models.py
│   │   └── state.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── app.py
├── features.py
├── graph_builder.py
├── parser.py
├── simulator.py
└── FEATURES.md
```

---

## ⚙️ Requirements

* 🐍 Python 3.11+
* 🟢 Node.js 18+
* 📦 npm

> ✅ This repo already includes:
>
> * Virtual environment (`venv`)
> * Frontend dependencies (`node_modules`)

---

## 🧠 Backend Setup

From the project root:

```powershell
.\venv\Scripts\Activate.ps1
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

🌐 Backend runs at: `http://localhost:8000`


---

## 💻 Frontend Setup

In a second terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

🌐 Frontend runs at: `http://localhost:5173`

### 🪟 Windows PowerShell Notes

* Use `npm.cmd` instead of `npm`

---



🎯 Demonstrates:

* Parsing
* Feature extraction
* Graph building
* Delay simulation

---

## 🧰 Tech Stack

### Backend

* ⚡ FastAPI
* 📦 Pydantic
* 🔗 NetworkX
* 🔢 NumPy
* 🔁 Tenacity
* 🤖 OpenAI SDK
* 🧠 spaCy

### Frontend

* ⚛️ React
* 🟦 TypeScript
* ⚡ Vite
* 🎞️ Framer Motion
* 📊 Recharts

---



## 🔮 Future Improvements

* ✅ Add automated API tests
* 📄 Provide sample scripts
* 📦 Add `.env.example`
* 🚀 Deployment guides (backend + frontend)

---

## 💡 Final Notes

Script AI bridges storytelling 🎭 and production logistics 🎬—helping teams make smarter, data-driven filmmaking decisions.

---
