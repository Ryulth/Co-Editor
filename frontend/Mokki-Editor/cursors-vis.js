class Caret {
    constructor(){
        this.caretContainer = document.createElement("DIV");
        this.caretContainer.classList.add("caret-container");
        document.body.appendChild(this.caretContainer);
        this.caretWrappers = {};
    }

    createCaret(key, value, color){
        if(!(key in this.caretWrappers)){
            let caretFrame = document.createElement("SPAN");
            let caretWrapper = document.createElement("SPAN");
            caretFrame.classList.add("caret-frame");
            caretWrapper.classList.add("caret-wrapper");
            caretFrame.id = "container-"+key;
            caretWrapper.appendChild(getCreatedCursorWrapper(color));
            caretWrapper.appendChild(getCreatedCaretFlag(value, color));
            caretFrame.appendChild(caretWrapper);
            this.caretContainer.appendChild(caretFrame);
            this.caretWrappers[key] = caretWrapper;
        }
    }

    moveCaret(key, rect){
        if(key in this.caretWrappers){
            let caretFrame = document.querySelector("#container-"+key);
            let caretWrapper = caretFrame.querySelector(".caret-wrapper");
            caretWrapper.style.top = rect.top+document.documentElement.scrollTop+document.getElementById("mokkiTextPreview").scrollTop+"px";
            caretWrapper.style.left = rect.left+"px";
            caretWrapper.style.height = rect.height+"px";
        }
    }

    createDrag(key, rect){
        console.log(rect.top+document.documentElement.scrollTop+document.getElementById("mokkiTextPreview").scrollTop);
        let caretFrame = document.querySelector("#container-"+key);
        let caretDrag = document.createElement("SPAN");
        caretDrag.classList.add("caret-drags");
        caretDrag.style.top = rect.top+document.documentElement.scrollTop+document.getElementById("mokkiTextPreview").scrollTop+"px";
        caretDrag.style.left = rect.left+"px";
        caretDrag.style.width = rect.width+"px";
        caretDrag.style.height = rect.height+"px";
        caretDrag.style.backgroundColor = getComputedStyle(caretFrame.querySelector(".caret-cursors")).backgroundColor;
        caretFrame.appendChild(caretDrag);
    }

    removeDrags(key){
        let caretFrame = document.querySelector("#container-"+key);
        Array.prototype.slice.call(caretFrame.querySelectorAll(".caret-drags")).forEach(element => {
            element.remove();
        });
    }

    removeCaret(key){
        if(key in this.caretWrappers){
            let caretFrame = document.querySelector("#container-"+key);
            let caretWrapper = caretFrame.querySelector(".caret-wrapper");
            caretWrapper.remove();
            delete this.caretWrappers[key];
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