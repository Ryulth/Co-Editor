window.onload = function(){
    let inputEventType = /Trident/.test( navigator.userAgent ) ? 'textinput' : 'input';
    let editableElement = document.getElementById("editable");
    let setCaretButton = document.getElementById("setCaret");
    let caretBegin = document.getElementById("caretBegin");
    let caretEnd = document.getElementById("caretEnd");

    if(editableElement.addEventListener){
        editableElement.addEventListener(inputEventType, function(){
            showCaretPosition(editableElement);
        });
        editableElement.addEventListener("keyup", function(){
            showCaretPosition(editableElement);
        });
        editableElement.addEventListener("mouseup", function(){
            showCaretPosition(editableElement);
        });
    }else if(editableElement.attachEvent){
        editableElement.attachEvent("input", function(){
            showCaretPosition(editableElement);
        });
        editableElement.attachEvent("keyup", function(){
            showCaretPosition(editableElement);
        });
        editableElement.attachEvent("mouseup", function(){
            showCaretPosition(editableElement);
        });
    }

    setCaretButton.onclick = function(){
        editableElement.focus();
        setCaretPosition(editableElement, caretBegin.value, caretEnd.value);
    }
}

const showCaretPosition = function(element){
    let caretBegin = document.getElementById("caretBegin");
    let caretEnd = document.getElementById("caretEnd");
    caretBegin.value = getCaretPositionStart(element);
    caretEnd.value = getCaretPositionEnd(element);
}