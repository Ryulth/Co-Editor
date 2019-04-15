
const ie = (typeof document.selection != "undefined" && document.selection.type != "Control") && true;
const w3 = (typeof window.getSelection != "undefined") && true;
let editorEl;
let editorBarEl;
let editort;
window.onload = function () {
    var editor = new tui.Editor({
        el: document.querySelector('#editSection'),
        initialEditType: 'wysiwyg',
        previewStyle: 'vertical',
        height: '300px'
    });
    editorEl = document.getElementsByClassName("tui-editor-contents")[1];
    editorBarEl = document.getElementsByClassName("tui-editor-defaultUI-toolbar")[0];
    Coedit.setEditor(editorEl,editorBarEl);
}