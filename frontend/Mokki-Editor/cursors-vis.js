class Caret {
    constructor(){
        this.caretContainer = document.createElement("DIV");
        this.caretContainer.classList.add("caret-container");
        document.body.appendChild(this.caretContainer);
        this.caretWrappers = {};
    }

    createCaret(key, value, color){
        if(!(key in this.caretWrappers)){
            let caretWrapper = document.createElement("SPAN");
            caretWrapper.classList.add("caret-wrapper");
            caretWrapper.id = "container-"+key;
            caretWrapper.appendChild(getCreatedCursorWrapper(color));
            caretWrapper.appendChild(getCreatedCaretFlag(value, color));
            this.caretContainer.appendChild(caretWrapper);
            this.caretWrappers[key] = caretWrapper;
            console.log(this.caretWrappers)
        }
    }

    moveCaret(key, rect){
        if(key in this.caretWrappers){
            let caretWrapper = document.querySelector("#container-"+key);
            caretWrapper.style.top = rect.top+"px";
            caretWrapper.style.left = rect.left+"px";
            caretWrapper.style.height = rect.height+"px";
        }
    }
}

const getCreatedCursorWrapper = function(color){
    let cursorWrapper = document.createElement("SPAN");
    let caretCursorElement = document.createElement("SPAN");
    cursorWrapper.classList.add("caret-cursors-wrapper");
    caretCursorElement.classList.add("caret-cursors");
    caretCursorElement.style.backgroundColor = color;
    cursorWrapper.appendChild(caretCursorElement)
    return cursorWrapper;
}

const getCreatedCaretFlag = function(name, color){
    let caretFlag = document.createElement("DIV");
    let caretName = document.createElement("SMALL");
    caretFlag.classList.add("caret-flag");
    caretFlag.style.backgroundColor = color;
    caretFlag.appendChild(caretName);
    caretName.classList.add("caret-name");
    caretName.innerText = name;
    return caretFlag;
}