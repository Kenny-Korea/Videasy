const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
// const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
// console.log(ffmpegPath)

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

// 기본 경로
let ffmpegPath = ffmpegInstaller.path;

// app.asar가 경로에 포함되어 있으면 .unpacked로 경로 보정
if (ffmpegPath.includes('app.asar')) {
  ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
}

// ffmpeg 경로 설정
// 개발 모드와 배포 모드에서 경로가 다름
let ffmpegBinaryPath;
if (app.isPackaged) {
  // 패키징된 애플리케이션에서는 extraResources에 복사된 바이너리 사용
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin") {
    // macOS
    if (arch === "arm64") {
      ffmpegBinaryPath = path.join(process.resourcesPath, "ffmpeg", "darwin-arm64", "ffmpeg");
    } else {
      ffmpegBinaryPath = path.join(process.resourcesPath, "ffmpeg", "darwin-x64", "ffmpeg");
    }
  } else if (platform === "win32") {
    // Windows
    ffmpegBinaryPath = path.join(process.resourcesPath, "ffmpeg", "win32-x64", "ffmpeg.exe");
  } else {
    // Linux
    ffmpegBinaryPath = path.join(process.resourcesPath, "ffmpeg", "linux-x64", "ffmpeg");
  }

  if (fs.existsSync(ffmpegBinaryPath)) {
    console.log("FFmpeg 바이너리 경로:", ffmpegBinaryPath);
    ffmpeg.setFfmpegPath(ffmpegBinaryPath);
  } else {
    console.error("FFmpeg 바이너리를 찾을 수 없습니다:", ffmpegBinaryPath);
    // 로컬 환경에서의 기본 설정 사용
    ffmpeg.setFfmpegPath(ffmpegPath);
  }
} else {
  // 개발 환경에서는 node_modules의 바이너리 사용
  ffmpeg.setFfmpegPath(ffmpegPath);
}

// 개발 모드와 프로덕션 모드 구분
const isDev = !app.isPackaged;

// 윈도우 객체를 전역 참조로 유지
let mainWindow;

function createWindow() {
  // 브라우저 윈도우 생성
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // index.html 로드
  mainWindow.loadFile("index.html");

  // 개발자 도구 열기 (개발 시에만 사용)
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // 윈도우가 닫힐 때 발생하는 이벤트
  mainWindow.on("closed", function () {
    mainWindow = null;
  });
}

// Electron이 준비되면 창 생성
app.whenReady().then(createWindow);

// 모든 창이 닫히면 앱 종료 (macOS 제외)
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", function () {
  // macOS에서는 dock 아이콘 클릭 시 창이 없으면 다시 생성
  if (mainWindow === null) createWindow();
});

// IPC 이벤트 핸들러: 비디오 파일 선택
ipcMain.on("select-video", async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "비디오 파일", extensions: ["mp4", "avi", "mov", "mkv"] }],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    event.reply("video-selected", result.filePaths[0]);
  }
});

// IPC 이벤트 핸들러: 비디오 자르기
ipcMain.on("cut-video", (event, { inputPath, startTime, endTime, outputFilename }) => {
  const fileExt = path.extname(inputPath);
  const dirName = path.dirname(inputPath);
  const outputPath = path.join(dirName, `${outputFilename}${fileExt}`);

  ffmpeg(inputPath)
    .setStartTime(startTime)
    .setDuration(endTime - startTime)
    .output(outputPath)
    .on("end", () => {
      event.reply("cut-complete", {
        success: true,
        outputPath,
      });
    })
    .on("error", (err) => {
      console.error("Error:", err);
      event.reply("cut-complete", {
        success: false,
        error: err.message,
      });
    })
    .run();
});
