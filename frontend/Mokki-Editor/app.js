const ie = (typeof document.selection != "undefined" && document.selection.type != "Control") && true;
const w3 = (typeof window.getSelection != "undefined") && true;
let editorEl;
let editorBarEl;
window.onload = function () {
    editorEl = document.getElementById("mokkiTextPreview");
    editorBarEl =document.getElementById("mokkiButtonBar");
    Coedit.setEditor(editorEl,editorBarEl);
}