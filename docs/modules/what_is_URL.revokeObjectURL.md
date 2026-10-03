# URL.revokeObjectURL()
`URL.createObjectURL()`로 만든 임시 URL을
더 이상 사용하지 않겠다고 브라우저에 알려주는 함수

사용자가 로컬 파일을 선택하고 미리보기 하는 기능을 만들 때 자주 만난다.
object URL을 다 쓴 뒤에는 `revokeObejctURL()`로 해제해서 
불필요하게 메모리를 잡고 있지 않아야 한다.

`createObjectURL()`부터 보면
사용자가 이미지를 선택했다고 하자.

```js
const file = input.files[0];

const url = URL.createObjectURL(file);

console.log(url);
// blob:https://example.com/550e8400-e29b-41d4-a716-446655440000
```
(이 url은 브라우저 내부의 File 또는 Blob을 가리키는 임시 주소다.)

모든 참조가 없으면 blob은 garbage collector에 의해 수거되기에 revoke를 해야 한다.