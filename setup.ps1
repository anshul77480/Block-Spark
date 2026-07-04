# Windows PowerShell Setup and Run script for Insider Threat Detection & Response POC.
# Replicates setup.sh functionality natively on Windows.

param (
    [switch]$SkipInstall,
    [switch]$InstallOnly,
    [switch]$Stop
)

$ErrorActionPreference = "Stop"

# Paths
$ROOT = Get-Item .
$LOG_DIR = Join-Path $ROOT "logs"
$PID_DIR = Join-Path $ROOT ".pids"

if (-not (Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR | Out-Null }
if (-not (Test-Path $PID_DIR)) { New-Item -ItemType Directory -Path $PID_DIR | Out-Null }

$BACKEND_PORT = 8000
$FRONTEND_PORT = 3000
$RPC_PORT = 8545
$maxWait = 60

# Colors & Logging helpers
function Log-Info($msg) {
    Write-Host "[setup] $msg" -ForegroundColor Cyan
}

function Log-Ok($msg) {
    Write-Host "[ ok ] $msg" -ForegroundColor Green
}

function Log-Warn($msg) {
    Write-Host "[warn] $msg" -ForegroundColor Yellow
}

function Log-Die($msg) {
    Write-Host "[fail] $msg" -ForegroundColor Red
    exit 1
}

# Stop Helper
function Stop-Services {
    Log-Info "Stopping services running on ports $RPC_PORT, $BACKEND_PORT, $FRONTEND_PORT..."
    $ports = @($RPC_PORT, $BACKEND_PORT, $FRONTEND_PORT)
    foreach ($port in $ports) {
        $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($conn in $conns) {
                $targetPid = $conn.OwningProcess
                Log-Info "Stopping process $targetPid on port $port..."
                Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
            }
        }
    }
    # Also stop any tracked PIDs
    if (Test-Path $PID_DIR) {
        foreach ($file in Get-ChildItem -Path $PID_DIR -Filter "*.pid" -ErrorAction SilentlyContinue) {
            $targetPid = Get-Content $file.FullName -ErrorAction SilentlyContinue
            if ($targetPid) {
                Log-Info "Stopping process $targetPid from $($file.Name)..."
                Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
            }
            Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
        }
    }
    Log-Ok "All services stopped."
}

if ($Stop) {
    Stop-Services
    exit 0
}

# Prerequisites Check
Log-Info "Checking prerequisites..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Log-Die "Node.js is required (>=18). Please install Node.js."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Log-Die "npm is required. Please install npm."
}
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Log-Die "python (Python 3.11+ recommended) is required. Please install Python."
}

Log-Ok "Prerequisites present: Node.js $(node -v), Python $((python --version 2>&1))"

# Install Dependencies
if (-not $SkipInstall) {
    # 1. Backend
    Log-Info "backend: setting up virtual environment and installing requirements..."
    Push-Location backend
    if (-not (Test-Path ".venv")) {
        python -m venv .venv
    }
    # Use python and pip inside .venv directly to avoid activation headaches in PowerShell execution policy
    & .venv\Scripts\python.exe -m pip install --upgrade pip -q
    & .venv\Scripts\pip.exe install -q -r requirements.txt
    if (-not (Test-Path ".env")) {
        Copy-Item .env.example .env
    }
    Pop-Location
    Log-Ok "Backend dependencies installed."

    # 2. Blockchain
    Log-Info "blockchain: installing Hardhat dependencies..."
    Push-Location blockchain
    if (-not (Test-Path "node_modules")) {
        npm install --silent
    }
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx hardhat compile" -NoNewWindow -Wait
    Pop-Location
    Log-Ok "Blockchain dependencies installed and contract compiled."

    # 3. Frontend
    Log-Info "frontend: installing Next.js dependencies..."
    Push-Location frontend
    if (-not (Test-Path "node_modules")) {
        npm install --silent
    }
    if (-not (Test-Path ".env.local")) {
        Copy-Item .env.local.example .env.local
    }
    Pop-Location
    Log-Ok "Frontend dependencies installed."
} else {
    Log-Warn "Skipping dependency installation (--SkipInstall)."
}

if ($InstallOnly) {
    Log-Ok "Installation only completed successfully."
    exit 0
}

# Load .env configuration to check if running local or remote node
$ENV_PATH = Join-Path $ROOT "backend\.env"
$rpcUrl = "http://127.0.0.1:8545"
$contractAddr = ""
if (Test-Path $ENV_PATH) {
    Get-Content $ENV_PATH | ForEach-Object {
        if ($_ -match "^\s*RPC_URL\s*=\s*(.*)") {
            $rpcUrl = $Matches[1].Trim()
        }
        if ($_ -match "^\s*CONTRACT_ADDRESS\s*=\s*(.*)") {
            $contractAddr = $Matches[1].Trim()
        }
    }
}

# Start services
Stop-Services
Start-Sleep -Seconds 2

# Helper to check if TCP port is open
function Test-PortOpen($port) {
    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
        $tcp.Connect("127.0.0.1", $port)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

$isLocalRpc = ($rpcUrl -like "*127.0.0.1*" -or $rpcUrl -like "*localhost*")

if ($isLocalRpc) {
    # 1. Start Hardhat Node
    Log-Info "Starting Hardhat node on port $RPC_PORT..."
    Push-Location blockchain
    $chainProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx hardhat node" -NoNewWindow -PassThru -RedirectStandardOutput "$LOG_DIR\chain.log" -RedirectStandardError "$LOG_DIR\chain.err.log"
    $chainProcess.Id | Out-File "$PID_DIR\chain.pid"
    Pop-Location

    # Wait for RPC node
    Log-Info "Waiting for Hardhat node to accept connections..."
    $waited = 0
    while (-not (Test-PortOpen $RPC_PORT)) {
        Start-Sleep -Seconds 1
        $waited++
        if ($waited -ge $maxWait) {
            Log-Die "Hardhat node did not start within $maxWait seconds. Check logs\chain.log and logs\chain.err.log"
        }
    }
    Log-Ok "Hardhat node is up."

    # 2. Deploy Contract
    Log-Info "Deploying AuditLog contract..."
    Push-Location blockchain
    $deployProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx hardhat run scripts/deploy.js --network localhost" -NoNewWindow -PassThru -Wait -RedirectStandardOutput "$LOG_DIR\deploy.log" -RedirectStandardError "$LOG_DIR\deploy.err.log"
    if ($deployProcess.ExitCode -ne 0) {
        Log-Die "AuditLog contract deployment failed. Check logs\deploy.log and logs\deploy.err.log"
    }
    $contractAddr = Get-Content "deployed_address.txt" -ErrorAction SilentlyContinue
    Pop-Location
    Log-Ok "AuditLog deployed to: $contractAddr"
} else {
    Log-Info "Using external RPC node: $rpcUrl"
    if ($contractAddr) {
        Log-Ok "Using configured contract address: $contractAddr"
    } else {
        Log-Die "External RPC node is configured but CONTRACT_ADDRESS is missing in backend/.env"
    }
}

# 3. Seed + Train
Log-Info "Seeding database (admin + baseline activity)..."
Push-Location backend
$seedProcess = Start-Process -FilePath ".venv\Scripts\python.exe" -ArgumentList "-m app.seed" -NoNewWindow -PassThru -Wait -RedirectStandardOutput "$LOG_DIR\seed.log" -RedirectStandardError "$LOG_DIR\seed.err.log"
if ($seedProcess.ExitCode -ne 0) {
    Log-Die "Database seeding failed. Check logs\seed.log and logs\seed.err.log"
}
Log-Ok "Database seeded."

Log-Info "Training Isolation Forest..."
$trainProcess = Start-Process -FilePath ".venv\Scripts\python.exe" -ArgumentList "train_model.py" -NoNewWindow -PassThru -Wait -RedirectStandardOutput "$LOG_DIR\train.log" -RedirectStandardError "$LOG_DIR\train.err.log"
if ($trainProcess.ExitCode -ne 0) {
    Log-Die "Model training failed. Check logs\train.log and logs\train.err.log"
}
$trainMsg = Get-Content "$LOG_DIR\train.log" | Select-Object -Last 1
Log-Ok "Model trained: $trainMsg"
Pop-Location

# 4. Start Backend API
Log-Info "Starting backend API on port $BACKEND_PORT..."
Push-Location backend
$backendProcess = Start-Process -FilePath ".venv\Scripts\python.exe" -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port $BACKEND_PORT" -NoNewWindow -PassThru -RedirectStandardOutput "$LOG_DIR\backend.log" -RedirectStandardError "$LOG_DIR\backend.err.log"
$backendProcess.Id | Out-File "$PID_DIR\backend.pid"
Pop-Location

Log-Info "Waiting for backend API..."
$waited = 0
while (-not (Test-PortOpen $BACKEND_PORT)) {
    Start-Sleep -Seconds 1
    $waited++
    if ($waited -ge $maxWait) {
        Log-Die "Backend API did not start within $maxWait seconds. Check logs\backend.log and logs\backend.err.log"
    }
}
Log-Ok "Backend API is up."

# 5. Start Frontend Dashboard
Log-Info "Starting frontend dashboard on port $FRONTEND_PORT..."
Push-Location frontend
$frontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -NoNewWindow -PassThru -RedirectStandardOutput "$LOG_DIR\frontend.log" -RedirectStandardError "$LOG_DIR\frontend.err.log"
$frontendProcess.Id | Out-File "$PID_DIR\frontend.pid"
Pop-Location

Log-Info "Waiting for frontend..."
$waited = 0
while (-not (Test-PortOpen $FRONTEND_PORT)) {
    Start-Sleep -Seconds 1
    $waited++
    if ($waited -ge 90) {
        Log-Warn "Frontend dashboard is slow to start. Check logs\frontend.log and logs\frontend.err.log"
        break
    }
}
Log-Ok "Frontend dashboard is up."

# Output banner
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host " Insider Threat SOC is running natively on Windows" -ForegroundColor Green
Write-Host "   Dashboard : http://localhost:$FRONTEND_PORT (login: admin / admin123)"
Write-Host "   API docs  : http://localhost:$BACKEND_PORT/docs"
Write-Host "   Chain RPC : http://localhost:$RPC_PORT"
Write-Host ""
Write-Host "   Logs      : logs/ directory"
Write-Host "   Stop      : Run .\setup.ps1 -Stop"
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""

# Monitor processes
try {
    Log-Info "Tailing logs (press Ctrl+C to exit script, processes will continue to run)"
    Log-Info "To stop everything, run: .\setup.ps1 -Stop"
    Write-Host "--- Tail of Backend Log ---"
    Get-Content "$LOG_DIR\backend.log" -Tail 10 -Wait
} catch {
    Log-Info "Exited log tailing. Note: Services are still running in background!"
    Log-Info "To stop them, run: .\setup.ps1 -Stop"
}
