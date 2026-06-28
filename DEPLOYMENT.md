# Deployment & Model Training Guide: Project Omni Brain

This guide provides a comprehensive, step-by-step walk-through for deploying the Project Omni full-stack workspace, spinning up the Python `OmniBrain` orchestration core, ingestion-training the localized memory, fine-tuning custom models, and converting them to quantized deployment formats (like GGUF).

---

## Part 1: Full-Stack Deployment

Omni is structured to run as a containerized microservice. It is designed to be fully compatible with major cloud providers (Google Cloud Run, AWS ECS, or self-hosted Docker clusters).

### 1. Environment Configuration
Create a `.env` file at your workspace root with the necessary secrets:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Core Security Credentials
OMNI_SECRET_KEY=your-jwt-or-hmac-secret-here

# Cognitive AI Intelligence (Gemini Key for server-side execution)
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase Persistent Sync Credentials
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_DATABASE_ID=(default)
```

### 2. Multi-Stage Containerization (Dockerfile)
Omni uses a multi-stage Docker build to keep image sizes exceptionally light while maintaining isolated NodeJS and Python runtime dependencies.

```dockerfile
# --- Stage 1: Build Frontend Assets ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2: Final Release Image ---
FROM python:3.11-slim-bookworm
WORKDIR /app

# Install Node.js inside Python environment for Gateway serving
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files and built frontend assets
COPY --from=frontend-builder /app/dist ./dist
COPY --from=frontend-builder /app/package*.json ./
COPY --from=frontend-builder /app/node_modules ./node_modules
COPY . .

# Expose single ingress port (Enterprise standard)
EXPOSE 3000

# Start Gateway (which boots Express and manages Python subprocesses)
CMD ["npm", "run", "start"]
```

### 3. Deploying to Cloud Run via CLI
Use the Google Cloud SDK to build and push the container directly to production:

```bash
# Authenticate to your GCP project
gcloud auth login
gcloud config set project your-project-id

# Build the container image securely using Cloud Build
gcloud builds submit --tag gcr.io/your-project-id/omni-workspace:latest

# Deploy with automatic scaling and secure environment variables
gcloud run deploy omni-workspace \
  --image gcr.io/your-project-id/omni-workspace:latest \
  --platform managed \
  --region europe-west2 \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars="NODE_ENV=production,GEMINI_API_KEY=your_gemini_key"
```

---

## Part 2: Local Brain Execution (`OmniBrain` Setup)

To run the localized AI brain in your own environment (on-premise or high-performance GPU workstation), follow these steps:

### 1. Hardware Requirements
* **Inference Only (Small Brain - 7B/14B Parameters)**: Apple Silicon Mac (M1/M2/M3 Pro/Max) or 1x NVIDIA RTX 3090/4090 (24GB VRAM).
* **Fine-tuning & Training Core**: 1x or 2x NVIDIA H100/A100 (80GB VRAM) or RTX 6000 Ada (48GB VRAM).

### 2. Local Virtual Environment Setup
Ensure you have Python 3.10+ installed.

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Upgrade base packaging tools
pip install --upgrade pip setuptools wheel

# Install PyTorch with CUDA support (or MPS for Apple Silicon)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install Project requirements
pip install -r requirements.txt
```

---

## Part 3: Brain Training & Ingestion

Training the Project Omni brain occurs in two phases: **CompanyMemory Ingestion (Semantic Linking)** and **SFT/LoRA Fine-Tuning (Behavior Adjustment)**.

```
       [Raw Files / Code / PDF Docs]
                    │
                    ▼
     ┌─────────────────────────────┐
     │  CompanyMemory Ingestion     │  <-- Vector Store / Semantic Linking
     └──────────────┬──────────────┘
                    │
                    ▼
     ┌─────────────────────────────┐
     │  SFT / LoRA Dataset Gen     │  <-- Q&A Pair Formats
     └──────────────┬──────────────┘
                    │
                    ▼
     ┌─────────────────────────────┐
     │  Supervised Fine-Tuning     │  <-- PyTorch / HuggingFace Script
     └──────────────┬──────────────┘
                    │
                    ▼
     ┌─────────────────────────────┐
     │   GGUF Export & Quantize    │  <-- Model ready for deployment
     └─────────────────────────────┘
```

### Phase 1: CompanyMemory Ingestion (RAG Pipeline)
To feed local domain guides, APIs, and company templates into the brain’s localized memory:

1. Place raw documentation (`.pdf`, `.md`, `.tsx`, `.json`) inside `core/training_data/`.
2. Run the memory compiler script to parse, slice, embed, and store knowledge inside the local memory database:

```bash
python core/scripts/compile_memory.py --source core/training_data/ --output core/memory_db/
```

### Phase 2: Core Model Supervised Fine-Tuning (SFT)
To teach the model *how* to act like Project Omni (system rules, structured response format, code extraction patterns), perform Supervised Fine-Tuning.

#### 1. Dataset Generation (alpaca-format)
Create a JSON file `training_dataset.json` containing pairs of prompts and the target Omni structured responses:

```json
[
  {
    "instruction": "Design a clean landing card layout for a weather app.",
    "input": "User wants clean design with soft shadows.",
    "output": "### Weather Dashboard\nHere is an interactive layout. ... \n```html\n<div class=\"shadow-sm rounded-xl p-6 bg-white\">...</div>\n```"
  }
]
```

#### 2. Execute Fine-Tuning using PEFT & LoRA
Use the following Python fine-tuning script (`train_brain.py`) to adapt a base LLM (e.g., Llama-3-8B or Mistral-7B) to become a specialized Omni Brain:

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from datasets import load_dataset
from peft import LoraConfig, get_peft_model, TaskType

# 1. Load Base Model & Tokenizer
model_id = "meta-llama/Meta-Llama-3-8B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(model_id)
tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    model_id,
    device_map="auto",
    torch_dtype=torch.bfloat16
)

# 2. Configure Parameter-Efficient Fine-Tuning (LoRA)
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type=TaskType.CAUSAL_LM
)
model = get_peft_model(model, lora_config)

# 3. Load & Format Dataset
dataset = load_dataset("json", data_files="training_dataset.json")

def format_prompts(batch):
    texts = []
    for inst, inp, out in zip(batch['instruction'], batch['input'], batch['output']):
        text = f"<|im_start|>system\nYou are Omni Brain, an expert multi-agent software architect.<|im_end|>\n"
        text += f"<|im_start|>user\n{inst}\n{inp}<|im_end|>\n"
        text += f"<|im_start|>assistant\n{out}<|im_end|>"
        texts.append(text)
    return {"text": texts}

formatted_dataset = dataset.map(format_prompts, batched=True)

# 4. Define Training Arguments
training_args = TrainingArguments(
    output_dir="./omni_brain_weights",
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    logging_steps=10,
    max_steps=100,
    fp16=False,
    bf16=True,
    save_strategy="steps",
    save_steps=50,
    report_to="none"
)

# 5. Initialize Trainer
from transformers import Trainer, DataCollatorForLanguageModeling
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=formatted_dataset["train"],
    data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False)
)

# 6. Begin Training
print("🚀 Launching Supervised Fine-Tuning Pipeline...")
trainer.train()

# 7. Merge and Save Weights
merged_model = model.merge_and_unload()
merged_model.save_pretrained("./omni_brain_final")
tokenizer.save_pretrained("./omni_brain_final")
print("🎉 Training Complete! Merged weights saved to ./omni_brain_final")
```

Run training:
```bash
python train_brain.py
```

---

## Part 4: Quantization & Model Extraction

To deploy your trained `omni-brain` model locally with minimal VRAM and maximum throughput, convert the raw HuggingFace weights into **GGUF format** and run them via Ollama or llama.cpp.

### 1. Set Up llama.cpp
Clone the quantization engine:

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
pip install -r requirements.txt
make
```

### 2. Convert to GGUF F32
Convert the Python PyTorch/Safetensors weights into a single GGUF file:

```bash
python convert_hf_to_gguf.py ../omni_brain_final/ --outfile ../omni-brain.gguf
```

### 3. Quantize to 4-bit (Q4_K_M)
Reduce file size by compressing weights into 4-bit levels (improving inference speed with negligible quality loss):

```bash
./llama-quantize ../omni-brain.gguf ../omni-brain-q4_k_m.gguf Q4_K_M
```
*The resulting file `omni-brain-q4_k_m.gguf` will be roughly **4.8 GB** for an 8B model and can easily be executed on consumer laptops.*

### 4. Load into Local Ollama Workspace
1. Create a file called `Modelfile` inside your workstation directory:

```dockerfile
FROM ./omni-brain-q4_k_m.gguf

# Set global model parameters
PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER stop "<|im_end|>"

# Inject Custom OmniBrain System Prompt template
SYSTEM """
You are Omni Brain, the core intelligence powering Project Omni's multi-agent software engineering workspace. You work alongside 16 specialized virtual machines to build pristine React, Tailwind CSS, and Node.js full-stack applications.
"""
```

2. Register the custom model with Ollama:

```bash
ollama create omni-brain -f Modelfile
```

3. Boot the model and query your localized brain:

```bash
ollama run omni-brain
```
This local server is now fully responsive via standard OpenAPI endpoints, allowing you to route Project Omni’s chat input boxes directly to your local workstation!
