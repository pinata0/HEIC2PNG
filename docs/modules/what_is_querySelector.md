# document.querySelector()
DOM(HTML 문서)에서 CSS 선택자에 해당하는 요소를 찾아주는 Javascript 메서드

조건에 맞는 요소 중 첫 번째 요소 하나만 반환한다.
조건에 맞는 요소가 없다면 null을 반환한다.

## 예시
```html
<h1 id="title">Hello</h1>
<p class="description">첫 번째 문장</p>
<p class="description">두 번째 문장</p>
```
에서

```js
const title = document.querySelector("#title");
```
를 사용하면

```html
<h1 id="title">Hello</h1>
```
이런 DOM Element 객체에 대한 참조가 반환된다.