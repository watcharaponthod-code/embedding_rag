@echo off
REM Local Docker Build and Push Script for Windows
REM Usage: build-and-push.bat [tag]

setlocal enabledelayedexpansion

REM Configuration
set DOCKER_REGISTRY=registry.sycapt.com:32547
set IMAGE_NAME=webclient-document-uploader
set DOCKER_IMAGE=%DOCKER_REGISTRY%/%IMAGE_NAME%

REM Get tag from argument or use 'local' as default
if "%1"=="" (
    set TAG=local
) else (
    set TAG=%1
)

REM Get git commit hash
for /f "tokens=*" %%i in ('git rev-parse --short HEAD 2^>nul') do set GIT_COMMIT=%%i
if "%GIT_COMMIT%"=="" set GIT_COMMIT=unknown

REM Get build date
for /f "tokens=*" %%i in ('powershell -Command "Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ' -AsUTC"') do set BUILD_DATE=%%i

echo =========================================
echo Building Docker Image
echo =========================================
echo Registry: %DOCKER_REGISTRY%
echo Image: %IMAGE_NAME%
echo Tag: %TAG%
echo Git Commit: %GIT_COMMIT%
echo Build Date: %BUILD_DATE%
echo =========================================
echo.

REM Build the Docker image
echo Step 1: Building Docker image...
docker build ^
  --tag %DOCKER_IMAGE%:%TAG% ^
  --tag %DOCKER_IMAGE%:%GIT_COMMIT% ^
  --build-arg BUILD_DATE=%BUILD_DATE% ^
  --build-arg VCS_REF=%GIT_COMMIT% ^
  --build-arg VERSION=%TAG% ^
  --progress=plain ^
  .

if errorlevel 1 (
    echo.
    echo Error: Build failed!
    exit /b 1
)

echo.
echo Build completed successfully!

REM Ask for confirmation before pushing
echo.
set /p PUSH_CONFIRM="Do you want to push to registry? (y/N): "
if /i "%PUSH_CONFIRM%"=="y" (
    echo.
    echo Step 2: Logging in to Docker registry...
    docker login %DOCKER_REGISTRY%

    if errorlevel 1 (
        echo.
        echo Error: Login failed!
        exit /b 1
    )

    echo.
    echo Step 3: Pushing Docker image...
    docker push %DOCKER_IMAGE%:%TAG%
    docker push %DOCKER_IMAGE%:%GIT_COMMIT%

    if errorlevel 1 (
        echo.
        echo Error: Push failed!
        exit /b 1
    )

    echo.
    echo Push completed successfully!
    echo.
    echo Image pushed to:
    echo   - %DOCKER_IMAGE%:%TAG%
    echo   - %DOCKER_IMAGE%:%GIT_COMMIT%
) else (
    echo.
    echo Skipping push to registry.
    echo.
    echo Local image available as:
    echo   - %DOCKER_IMAGE%:%TAG%
    echo   - %DOCKER_IMAGE%:%GIT_COMMIT%
)

echo.
echo =========================================
echo Build Summary
echo =========================================
docker images %DOCKER_IMAGE%

echo.
echo To deploy to Kubernetes, run:
echo   kubectl set image deployment/webclient-chat webclient-chat=%DOCKER_IMAGE%:%TAG% -n default
echo   kubectl rollout status deployment/webclient-chat -n default
echo.

endlocal
