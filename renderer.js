const { ipcRenderer } = require("electron");
const path = require("path");

// 요소 참조 가져오기
const selectVideoBtn = document.getElementById("select-video-btn");
const videoPathElement = document.getElementById("video-path");
const videoPlayerContainer = document.getElementById("video-player-container");
const videoPlayer = document.getElementById("video-player");
const editorSection = document.getElementById("editor-section");

// 기존 시간 입력 요소 (초 단위)
const startTimeInput = document.getElementById("start-time");
const endTimeInput = document.getElementById("end-time");

// 새로운 시간 형식 입력 요소 (시:분:초)
const startHoursInput = document.getElementById("start-hours");
const startMinutesInput = document.getElementById("start-minutes");
const startSecondsInput = document.getElementById("start-seconds");
const endHoursInput = document.getElementById("end-hours");
const endMinutesInput = document.getElementById("end-minutes");
const endSecondsInput = document.getElementById("end-seconds");

// 출력 파일명 입력란
const outputFilenameInput = document.getElementById("output-filename");

const cutVideoBtn = document.getElementById("cut-video-btn");
const statusMessage = document.getElementById("status-message");
const outputPathElement = document.getElementById("output-path");

// 현재 선택된 비디오 경로 저장
let currentVideoPath = null;
let defaultOutputFilename = ""; // 기본 출력 파일명 저장

// 시:분:초를 초로 변환하는 함수
function convertToSeconds(hours, minutes, seconds) {
  return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
}

// 초를 시:분:초로 변환하는 함수
function convertFromSeconds(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return { hours, minutes, seconds };
}

// 시간 입력 값을 변경할 때 초 단위 입력란 업데이트
function updateStartTimeSeconds() {
  const seconds = convertToSeconds(startHoursInput.value, startMinutesInput.value, startSecondsInput.value);
  startTimeInput.value = seconds;
}

function updateEndTimeSeconds() {
  const seconds = convertToSeconds(endHoursInput.value, endMinutesInput.value, endSecondsInput.value);
  endTimeInput.value = seconds;
}

// 초 단위 입력란 값이 변경될 때 시:분:초 입력란 업데이트
function updateStartTimeFormat() {
  const { hours, minutes, seconds } = convertFromSeconds(startTimeInput.value);
  startHoursInput.value = hours;
  startMinutesInput.value = minutes;
  startSecondsInput.value = seconds;
}

function updateEndTimeFormat() {
  const { hours, minutes, seconds } = convertFromSeconds(endTimeInput.value);
  endHoursInput.value = hours;
  endMinutesInput.value = minutes;
  endSecondsInput.value = seconds;
}

// 시간 입력 이벤트 리스너 추가
startHoursInput.addEventListener("change", updateStartTimeSeconds);
startMinutesInput.addEventListener("change", updateStartTimeSeconds);
startSecondsInput.addEventListener("change", updateStartTimeSeconds);
endHoursInput.addEventListener("change", updateEndTimeSeconds);
endMinutesInput.addEventListener("change", updateEndTimeSeconds);
endSecondsInput.addEventListener("change", updateEndTimeSeconds);

// 초 단위 입력란에 이벤트 리스너 추가
startTimeInput.addEventListener("change", updateStartTimeFormat);
endTimeInput.addEventListener("change", updateEndTimeFormat);

// 입력 필드 값 제한 함수
function limitInputValue(inputElement, min, max) {
  inputElement.addEventListener("change", () => {
    const value = parseInt(inputElement.value);
    if (isNaN(value) || value < min) {
      inputElement.value = min;
    } else if (value > max) {
      inputElement.value = max;
    }

    // 변경 후 연동된 필드 업데이트
    if (inputElement === startHoursInput || inputElement === startMinutesInput || inputElement === startSecondsInput) {
      updateStartTimeSeconds();
    } else if (inputElement === endHoursInput || inputElement === endMinutesInput || inputElement === endSecondsInput) {
      updateEndTimeSeconds();
    } else if (inputElement === startTimeInput) {
      updateStartTimeFormat();
    } else if (inputElement === endTimeInput) {
      updateEndTimeFormat();
    }
  });
}

// 모든 입력 필드에 제한 적용
limitInputValue(startHoursInput, 0, 99);
limitInputValue(startMinutesInput, 0, 59);
limitInputValue(startSecondsInput, 0, 59);
limitInputValue(endHoursInput, 0, 99);
limitInputValue(endMinutesInput, 0, 59);
limitInputValue(endSecondsInput, 0, 59);

// 이벤트 리스너: 비디오 파일 선택 버튼
selectVideoBtn.addEventListener("click", () => {
  ipcRenderer.send("select-video");
});

// 이벤트 리스너: 비디오 선택 완료
ipcRenderer.on("video-selected", (event, filePath) => {
  currentVideoPath = filePath;
  videoPathElement.textContent = filePath;

  // 기본 출력 파일명 설정 (기존파일명-cut)
  const fileExt = path.extname(filePath);
  const fileName = path.basename(filePath, fileExt);
  defaultOutputFilename = `${fileName}-cut`;

  // 출력 파일명 입력란의 placeholder 업데이트
  // outputFilenameInput.placeholder = defaultOutputFilename;
  outputFilenameInput.value = defaultOutputFilename;

  // 출력 파일명 입력란 초기화
  // outputFilenameInput.value = "";

  // 비디오 플레이어 설정
  videoPlayer.src = `file://${filePath}`;
  videoPlayerContainer.classList.remove("hidden");
  editorSection.classList.remove("hidden");

  // 비디오 메타데이터 로드 시 종료 시간 필드 업데이트
  videoPlayer.onloadedmetadata = () => {
    const durationInSeconds = videoPlayer.duration;
    endTimeInput.value = Math.floor(durationInSeconds);

    // 시:분:초 포맷도 업데이트
    updateEndTimeFormat();
  };

  // 상태 메시지 초기화
  statusMessage.textContent = "";
  statusMessage.className = "";
  outputPathElement.textContent = "";
});

// 이벤트 리스너: 비디오 자르기 버튼
cutVideoBtn.addEventListener("click", () => {
  if (!currentVideoPath) {
    alert("먼저 비디오 파일을 선택하세요.");
    return;
  }

  const startTime = parseFloat(startTimeInput.value);
  const endTime = parseFloat(endTimeInput.value);

  // 유효성 검사
  if (isNaN(startTime) || isNaN(endTime)) {
    alert("시작 및 종료 시간은 숫자여야 합니다.");
    return;
  }

  if (startTime >= endTime) {
    alert("종료 시간은 시작 시간보다 커야 합니다.");
    return;
  }

  if (startTime < 0) {
    alert("시작 시간은 0 이상이어야 합니다.");
    return;
  }

  if (endTime > videoPlayer.duration) {
    alert(`종료 시간은 비디오 길이(${videoPlayer.duration.toFixed(1)}초)보다 작아야 합니다.`);
    return;
  }

  // 출력 파일명 가져오기 (사용자 입력 또는 기본값)
  let outputFilename = outputFilenameInput.value.trim();
  if (!outputFilename) {
    outputFilename = defaultOutputFilename;
  }

  // 커팅 프로세스 시작
  statusMessage.textContent = "비디오 자르는 중...";
  statusMessage.className = "";
  outputPathElement.textContent = "";

  // 메인 프로세스로 비디오 자르기 요청 전송
  ipcRenderer.send("cut-video", {
    inputPath: currentVideoPath,
    startTime: startTime,
    endTime: endTime,
    outputFilename: outputFilename, // 출력 파일명 추가
  });
});

// 이벤트 리스너: 비디오 자르기 완료
ipcRenderer.on("cut-complete", (event, result) => {
  if (result.success) {
    statusMessage.textContent = "비디오 자르기 완료!";
    statusMessage.className = "success";
    outputPathElement.textContent = result.outputPath;
  } else {
    statusMessage.textContent = `오류 발생: ${result.error}`;
    statusMessage.className = "error";
  }
});
