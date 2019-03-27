# Library for Caret Position in ContentEditable div


## Function Document

|        function        | parameter | return | document | 
|        :-------        |:-------:   |:------:|:------|
| getCaretPositionStart  | element   | number | you can get start caret position |
| getCaretPositionEnd    | element   | number | you can get end caret position |
| getCaretPosition       | element   | Array | you can get caret position array that length is 2, first val is start position and second val is end position|
| setCaretPosition       | element, start position, end position  | none | you can move caret position |


## How To Use
##### in HTML
```html
<script src="{$PATH}/caret.js"></script>
...
<!-- Id or class required for this div -->
<div id="{$YOUR_ID}" contenteditable="true">...</div>
<div class="{$YOUR_CLASS}" contenteditable="true">...</div>
```

##### in JS
```js
let editalbeElement = document.getElementById("{$YOUR_ID}");
let editalbeElement = document.getElementsByClassName("{$YOUR_CLASS}")[index];
let startCaretPosition = getCaretPositionStart(editalbeElement); // number ex) 0, 1, 2, ...
let endCaretPosition = getCaretPositionStart(editalbeElement); // number ex) 0, 1, 2, ...
let caretPosition = getCaretPosition(editalbeElement); // array ex) [0, 0], [0, 1], [2, 3], ...
setCaretPosition(editalbeElement, 0, 1) // move the caret to the set location
```

