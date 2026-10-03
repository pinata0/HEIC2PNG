// 업로드할 수 있는 파일의 최대 크기와 확장자를 정의합니다.
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const allowedExtensions = ['heic', 'heif'];

// 화면의 입력 요소를 한 번만 찾아 이벤트 처리에 재사용합니다.
const fileInput = document.querySelector('#file-input');
const browseButton = document.querySelector('#browse-button');
const dropZone = document.querySelector('#drop-zone');
const fileList = document.querySelector('#file-list');
const errorMessage = document.querySelector('#error-message');
const statusMessage = document.querySelector('#status-message');
const convertButton = document.querySelector('#convert-button');

// 각 항목은 pending → converting → completed 또는 failed 순서로 상태가 바뀝니다.
const fileItems = [];
let nextFileId = 1;
let selectedFile = null;
let convertedBlob = null;
let objectUrl = null;
let isConverting = false;

const statusLabels = {
  pending: '대기 중',
  converting: '변환 중',
  completed: '완료',
  failed: '실패',
};

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

// 변환된 PNG Blob URL을 브라우저 다운로드로 전달합니다.
function downloadPng(url, originalFileName) {
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = originalFileName.replace(/\.(heic|heif)$/i, '.png');
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
}

// 변환 결과가 있는 파일의 Object URL과 Blob을 정리합니다.
function revokeItemResult(item) {
  if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
  item.objectUrl = null;
  item.convertedBlob = null;
}

// 모든 임시 Object URL을 정리합니다. 다운로드 직후에는 호출하지 않습니다.
function resetConversionState() {
  fileItems.forEach(revokeItemResult);
  convertedBlob = null;
  objectUrl = null;
  isConverting = false;
}

// 페이지를 떠날 때도 임시 Object URL을 해제합니다.
window.addEventListener('pagehide', resetConversionState);

// 파일별 상태 목록을 다시 그립니다.
function renderFileList() {
  fileList.replaceChildren();

  fileItems.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'file-summary file-item';

    const typeLabel = document.createElement('div');
    typeLabel.className = 'file-type';
    typeLabel.setAttribute('aria-hidden', 'true');
    typeLabel.textContent = 'HEIC';

    const details = document.createElement('div');
    details.className = 'file-details';
    const name = document.createElement('strong');
    name.textContent = item.file.name;
    const size = document.createElement('span');
    size.textContent = item.error || formatFileSize(item.file.size);
    details.append(name, size);

    const state = document.createElement('span');
    state.className = 'file-status';
    state.dataset.status = item.status;
    state.textContent = statusLabels[item.status];

    const removeButton = document.createElement('button');
    removeButton.className = 'remove-button';
    removeButton.type = 'button';
    removeButton.setAttribute('aria-label', `${item.file.name} 삭제`);
    removeButton.textContent = '×';
    removeButton.disabled = isConverting;
    removeButton.addEventListener('click', () => removeFile(item.id));

    row.append(typeLabel, details, state, removeButton);
    fileList.append(row);
  });

  fileList.hidden = fileItems.length === 0;
  convertButton.disabled = isConverting || !fileItems.some((item) => item.status === 'pending');
}

// 선택된 파일과 변환 결과를 모두 초기화합니다.
function resetFile() {
  resetConversionState();
  fileItems.length = 0;
  selectedFile = null;
  fileInput.value = '';
  errorMessage.textContent = '';
  statusMessage.textContent = '파일을 선택하면 변환할 수 있어요.';
  renderFileList();
}

// 파일 하나를 목록에 추가하고 검증 결과에 따라 초기 상태를 정합니다.
function createFileItem(file) {
  const error = getFileValidationError(file);
  return {
    id: nextFileId++,
    file,
    status: error ? 'failed' : 'pending',
    error,
    convertedBlob: null,
    objectUrl: null,
  };
}

// 파일 선택창 또는 드롭으로 들어온 여러 파일을 큐로 등록합니다.
function setFiles(files) {
  if (isConverting) return;
  resetFile();

  const incomingFiles = Array.from(files || []).filter(Boolean);
  if (incomingFiles.length === 0) return;

  fileItems.push(...incomingFiles.map(createFileItem));
  selectedFile = fileItems[0]?.file || null;
  const invalidItems = fileItems.filter((item) => item.error);
  const pendingCount = fileItems.length - invalidItems.length;

  if (invalidItems.length > 0) {
    errorMessage.textContent = invalidItems[0].error;
  }
  statusMessage.textContent = pendingCount > 0
    ? `${pendingCount}개 파일이 변환 대기 중이에요.`
    : '변환할 수 있는 HEIC 파일이 없어요.';
  renderFileList();
}

// 목록에서 파일 하나를 삭제합니다.
function removeFile(id) {
  if (isConverting) return;
  const index = fileItems.findIndex((item) => item.id === id);
  if (index === -1) return;
  const [removedItem] = fileItems.splice(index, 1);
  const removedObjectUrl = removedItem.objectUrl;
  revokeItemResult(removedItem);
  if (removedObjectUrl === objectUrl) {
    convertedBlob = null;
    objectUrl = null;
  }
  selectedFile = fileItems[0]?.file || null;
  errorMessage.textContent = '';
  const pendingCount = fileItems.filter((item) => item.status === 'pending').length;
  statusMessage.textContent = pendingCount > 0
    ? `${pendingCount}개 파일이 변환 대기 중이에요.`
    : '파일을 선택하면 변환할 수 있어요.';
  renderFileList();
}

// 파일 선택창을 열기만 하도록 연결합니다.
browseButton.addEventListener('click', (event) => {
  event.stopPropagation();
  fileInput.click();
});

// 드롭 영역 전체를 클릭하거나 키보드로 활성화해도 파일을 선택할 수 있게 합니다.
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
});

// 파일 선택창에서 고른 모든 파일을 동일한 큐에 등록합니다.
fileInput.addEventListener('change', () => setFiles(fileInput.files));

// 파일을 드래그하는 동안 드롭 영역의 시각적 상태를 표시합니다.
['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.add('dragging');
}));

// 드래그가 끝나면 시각적 상태를 원래대로 돌리고, 모든 드롭 파일을 큐에 등록합니다.
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragging');
}));
dropZone.addEventListener('drop', (event) => setFiles(event.dataTransfer.files));

// 대기 중인 파일을 한 번에 하나씩 순서대로 변환합니다.
convertButton.addEventListener('click', async () => {
  if (isConverting) return;
  const pendingItems = fileItems.filter((item) => item.status === 'pending');
  if (pendingItems.length === 0) return;

  isConverting = true;
  convertButton.disabled = true;
  statusMessage.textContent = 'PNG로 변환하는 중이에요.';
  renderFileList();

  for (const item of pendingItems) {
    item.status = 'converting';
    renderFileList();

    try {
      const pngBlob = await convertToPng(item.file);
      item.convertedBlob = pngBlob;
      item.objectUrl = URL.createObjectURL(pngBlob);
      convertedBlob = pngBlob;
      objectUrl = item.objectUrl;
      item.status = 'completed';
      downloadPng(item.objectUrl, item.file.name);
    } catch (error) {
      item.status = 'failed';
      item.error = '이 파일을 읽을 수 없어요. 다른 HEIC 파일을 선택해 주세요.';
      console.error(`HEIC to PNG 변환 실패 (${item.file.name}):`, error);
    }
    renderFileList();
  }

  const failedCount = fileItems.filter((item) => item.status === 'failed').length;
  if (failedCount > 0) {
    errorMessage.textContent = '이 파일을 읽을 수 없어요. 다른 HEIC 파일을 선택해 주세요.';
    statusMessage.textContent = '이 파일을 읽을 수 없어요. 다른 HEIC 파일을 선택해 주세요.';
  } else {
    statusMessage.textContent = 'PNG 변환이 완료됐어요.';
  }

  isConverting = false;
  renderFileList();
});
