
const ie = (typeof document.selection != "undefined" && document.selection.type != "Control") && true;
const w3 = (typeof window.getSelection != "undefined") && true;
let tuiEditor;
window.onload = function () {
    tuiEditor = new tui.Editor({
        el: document.querySelector('#editSection'),
        initialEditType: 'wysiwyg',
        previewStyle: 'vertical',
        height: '800px'
    });

    Coedit.setEditor(tuiEditor);
    console.log(window.RyulthTest);
}