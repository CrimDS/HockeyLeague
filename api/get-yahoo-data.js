# Darkspace Stable Diffusion WebUI Auto-Fix Launcher
Write-Host "============================================================"
Write-Host "   Darkspace Stable Diffusion WebUI Auto-Fix Launcher"
Write-Host "============================================================`n"

# Change to this script's folder
Set-Location $PSScriptRoot

# --- Check Python ---
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Python not found! Please install Python 3.10.6 (64-bit):"
    Write-Host "    https://www.python.org/downloads/release/python-3106/"
    Pause
    exit
}

$pyVersion = (python --version) -join ""
Write-Host "`nDetected Python version: $pyVersion`n"

# --- Ensure venv exists ---
if (-not (Test-Path "venv")) {
    Write-Host "🧱 Creating new virtual environment..."
    python -m venv venv
}

# --- Activate venv ---
$env:VIRTUAL_ENV = "$PSScriptRoot\venv"
$env:PATH = "$env:VIRTUAL_ENV\Scripts;$env:PATH"

# --- Upgrade pip ---
Write-Host "🔄 Upgrading pip..."
python -m pip install --upgrade pip

# --- Install CUDA 12.4 compatible PyTorch ---
Write-Host "`n🧠 Installing CUDA 12.4 compatible PyTorch..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/nightly/cu124

# --- Verify GPU support ---
Write-Host "`n🧪 Verifying GPU support..."
python - <<'PYCODE'
import torch
print("✅ CUDA available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("💻 GPU:", torch.cuda.get_device_name(0))
PYCODE

# --- Launch WebUI ---
Write-Host "`n🚀 Launching Stable Diffusion WebUI..."
python launch.py
Pause
