// 업로드할 수 있는 파일의 최대 크기와 확장자를 정의합니다.
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const allowedExtensions = ['heic', 'heif'];

// 화면의 입력 요소를 한 번만 찾아 이벤트 처리에 재사용합니다.
const fileInput = document.querySelector('#file-input');
const browseButton = document.querySelector('#browse-button');
const dropZone = document.querySelector('#drop-zone');
const fileSummary = document.querySelector('#file-summary');
const fileName = document.querySelector('#file-name');
const fileSize = document.querySelector('#file-size');
const errorMessage = document.querySelector('#error-message');
const statusMessage = document.querySelector('#status-message');
const convertButton = document.querySelector('#convert-button');
const removeButton = document.querySelector('#remove-button');

let selectedFile = null;
let convertedBlob = null;
let objectUrl = null;
let isConverting = false;

// 페이지가 모두 로드된 뒤 heic2any CDN 라이브러리가 전역 객체로 등록됐는지 확인합니다.
window.addEventListener('load', () => {
  if (typeof window.heic2any === 'function') {
    console.info('heic2any 라이브러리가 정상적으로 로드되었습니다.');
  } else {
    console.error('heic2any 라이브러리를 로드하지 못했습니다.');
  }
});

// 바이트 단위 파일 크기를 화면에 표시하기 쉬운 단위로 변환합니다.
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 파일 확장자가 HEIC 또는 HEIF인지 확인합니다.
function isSupported(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return allowedExtensions.includes(extension);
}

// 변환 전에 파일 존재 여부, 확장자, 크기를 순서대로 검증합니다.
function getFileValidationError(file) {
  if (!file) return '변환할 파일을 먼저 선택해 주세요.';
  if (!isSupported(file)) return 'HEIC 또는 HEIF 파일만 업로드할 수 있어요.';
  if (file.size > MAX_FILE_SIZE) return '파일 크기는 20MB 이하만 업로드할 수 있어요.';
  return '';
}

// 검증 실패 시 변환 버튼과 오류 메시지를 함께 갱신합니다.
function validateSelectedFile() {
  const validationError = getFileValidationError(selectedFile);
  if (validationError) {
    convertButton.disabled = true;
    errorMessage.textContent = validationError;
    return false;
  }
  errorMessage.textContent = '';
  return true;
}

// heic2any의 Blob 또는 Blob[] 반환값을 하나의 PNG Blob으로 정규화합니다.
function normalizePngBlob(result) {
  const pngBlob = Array.isArray(result) ? result[0] : result;
  if (!(pngBlob instanceof Blob)) throw new Error('PNG Blob을 생성하지 못했습니다.');
  return pngBlob;
}

// File을 우선 그대로 전달하고, 입력 오류가 발생한 경우에만 ArrayBuffer 기반 Blob으로 재시도합니다.
async function convertToPng(file) {
  if (typeof window.heic2any !== 'function') {
    throw new Error('heic2any 라이브러리를 사용할 수 없습니다.');
  }

  try {
    const result = await window.heic2any({ blob: file, toType: 'image/png' });
    return normalizePngBlob(result);
  } catch (error) {
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type || 'image/heic' });
    const result = await window.heic2any({ blob, toType: 'image/png' });
    return normalizePngBlob(result);
  }
}

// 이전 변환 결과와 다운로드용 Object URL을 정리합니다.
function resetConversionState() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  convertedBlob = null;
  objectUrl = null;
  isConverting = false;
}

// 선택된 파일과 화면 상태를 초기 상태로 되돌립니다.
function resetFile() {
  selectedFile = null;
  resetConversionState();
  fileInput.value = '';
  fileSummary.hidden = true;
  convertButton.disabled = true;
  statusMessage.textContent = '파일을 선택하면 변환할 수 있어요.';
}

// 파일을 선택하거나 드롭했을 때 형식과 크기를 검증하고 화면을 갱신합니다.
function setFile(file) {
  errorMessage.textContent = '';
  if (!file) return;
  resetConversionState();
  const validationError = getFileValidationError(file);
  if (validationError) {
    resetFile();
    errorMessage.textContent = validationError;
    return;
  }
  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatFileSize(file.size);
  fileSummary.hidden = false;
  convertButton.disabled = false;
  statusMessage.textContent = '변환할 파일이 준비됐어요.';
}

// 찾아보기 버튼은 숨겨진 파일 입력창을 열기만 하도록 연결합니다.
browseButton.addEventListener('click', (event) => { event.stopPropagation(); fileInput.click(); });

// 드롭 영역 전체를 클릭하거나 키보드로 활성화해도 파일을 선택할 수 있게 합니다.
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); }
});

// 파일 선택창에서 파일을 고른 경우에도 동일한 검증 로직을 사용합니다.
fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
removeButton.addEventListener('click', resetFile);

// 파일을 드래그하는 동안 드롭 영역의 시각적 상태를 표시합니다.
['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault(); dropZone.classList.add('dragging');
}));

// 드래그가 끝나면 시각적 상태를 원래대로 돌리고, 드롭된 파일을 검증합니다.
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault(); dropZone.classList.remove('dragging');
}));
dropZone.addEventListener('drop', (event) => setFile(event.dataTransfer.files[0]));

// 선택한 HEIC 파일을 PNG Blob으로 변환하고 다운로드용 Object URL을 준비합니다.
convertButton.addEventListener('click', async () => {
  if (isConverting) return;
  if (!validateSelectedFile()) return;

  const fileAtStart = selectedFile;
  resetConversionState();
  isConverting = true;
  convertButton.disabled = true;
  statusMessage.textContent = 'PNG로 변환하는 중이에요.';

  try {
    const pngBlob = await convertToPng(fileAtStart);
    if (selectedFile !== fileAtStart) return;
    convertedBlob = pngBlob;
    objectUrl = URL.createObjectURL(pngBlob);
    statusMessage.textContent = 'PNG 변환이 완료됐어요.';
  } catch (error) {
    if (selectedFile !== fileAtStart) return;
    errorMessage.textContent = '파일을 PNG로 변환하지 못했어요.';
    statusMessage.textContent = '다른 파일을 선택해 다시 시도해 주세요.';
  } finally {
    if (selectedFile === fileAtStart) {
      isConverting = false;
      convertButton.disabled = false;
    }
  }
});
