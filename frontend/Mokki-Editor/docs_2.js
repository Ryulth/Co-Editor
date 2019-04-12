const ie = (typeof document.selection != "undefined" && document.selection.type != "Control") && true;
const w3 = (typeof window.getSelection != "undefined") && true;
window.onload = function () {
    let editorEl = document.getElementById("mokkiTextPreview");
    Coedit.setEditor(editorEl);
}