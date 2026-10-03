# Blob

브라우저에서 파일처럼 다룰 수 있는 바이너리 데이터 덩어리
정식 명칭은 Binary Large Object

HEIC -> PNG 변환을 하면, PNG가 처음부터 디스크의 실제 파일로 생기는 게 아니라
메모리 안에 이런 형태로 존재한다
`const pngBlob = new Blob([pngBytes], {type: "image/png"});`
즉, `pngBlob`은 PNG의 실제 바이트 데이터 + "이 데이터는 image/png이다"라는 정보이다.

## File과의 차이

브라우저에서는 `File`도 `Blob`의 확장판이다.

Blob
├─ binary data
├─ size
└─ type

File
├─ binary data
├─ size
├─ type
├─ name
└─ lastModified

## 사용처

*HEIC2PNG의 흐름*
```
사용자가 photo.heic 선택
->
File 객체
->
HEIC 디코딩
-> 
픽셀 데이터
->
PNG 인코딩
->
PNG Blob
->
다운로드
```

변환된 PNG는 컴퓨터에 저장된 실제 파일이 아니라
브라우저 메모리에
```
Blob {
  type: "image/png",
  size: 18372941
}
```
형태로 존재한다.

그걸 다운로드 할 수 있게 URL로 바꾼다.
`const url = URL.createObjectURL(pngBlob);`
그럼 브라우저가 임시로
`blob:https://example.com/8f1a...`
같은 URL을 만들어준다.

이걸 링크에 연결하면
```javascript
const a = document.createElement("a");

a.href = url;
a.download = "photo.png";
a.click();
```
사용자가 PNG를 다운로드 할 수 있다.

## ArrayBuffer와의 차이

*Blob* -> 이 바이너리 데이터를 파일처럼 다루겠다.
*ArrayBuffer* -> 이 바이너리 데이터를 바이트 단위로 직접 다루겠다.

`const buffer = await file.arrayBuffer();`
하면 실제 바이트 데이터에 접근할 수 있게 된다.

따라서
Blob은 브라우저 메모리 안에 있는 바이너리 데이터를 파일처럼 취급하기 위한 객체이다.