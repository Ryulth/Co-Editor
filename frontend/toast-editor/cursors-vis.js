(function(){
    let caretContainer;
    let caretWrappers;
    const getCaretWrappers = function(){
        return caretWrappers;
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
    const init = function(){
        caretContainer = document.createElement("DIV");
        caretContainer.classList.add("caret-container");
        document.body.appendChild(caretContainer);
        caretWrappers = {};
    };
    const createCaret =  function(key, value, color){
        if(!(key in caretWrappers)){
            let caretFrame = document.createElement("SPAN");
            let caretWrapper = document.createElement("SPAN");
            caretFrame.classList.add("caret-frame");
            caretWrapper.classList.add("caret-wrapper");
            caretFrame.id = "container-"+key;
            caretWrapper.appendChild(getCreatedCursorWrapper(color));
            caretWrapper.appendChild(getCreatedCaretFlag(value, color));
            caretFrame.appendChild(caretWrapper);
            caretContainer.appendChild(caretFrame);
            caretWrappers[key] = caretWrapper;
        }
    };
    const moveCaret= function(key, rect, editor){
        let scrollHeight = 0;
        if(editor.scrollHeight == editor.clientHeight){
            scrollHeight = caretContainer.offsetTop;
        }
        if(key in caretWrappers){
            let caretFrame = document.querySelector("#container-"+key);
            let caretWrapper = caretFrame.querySelector(".caret-wrapper");
            caretWrapper.style.top = rect.top+editor.scrollTop-scrollHeight+"px";
            caretWrapper.style.left = rect.left+"px";
            caretWrapper.style.height = rect.height+"px";
        }
    };
    const createDrag = function(key, rect, editor){
        let scrollHeight = 0;
        if(editor.scrollHeight == editor.clientHeight){
            scrollHeight = caretContainer.offsetTop;
        }
        let caretFrame = document.querySelector("#container-"+key);
        let caretDrag = document.createElement("SPAN");
        caretDrag.classList.add("caret-drags");
        caretDrag.style.top = rect.top+editor.scrollTop-scrollHeight+"px";
        caretDrag.style.left = rect.left+"px";
        caretDrag.style.width = rect.width+"px";
        caretDrag.style.height = rect.height+"px";
        caretDrag.style.backgroundColor = getComputedStyle(caretFrame.querySelector(".caret-cursors")).backgroundColor;
        caretFrame.appendChild(caretDrag);
    };
    const removeDrags = function(key){
        let caretFrame = document.querySelector("#container-"+key);
        Array.prototype.slice.call(caretFrame.querySelectorAll(".caret-drags")).forEach(element => {
            element.remove();
        });
    };
    const removeCaret = function(key){
        if(key in caretWrappers){
            let caretFrame = document.querySelector("#container-"+key);
            let caretWrapper = caretFrame.querySelector(".caret-wrapper");
            caretWrapper.remove();
            delete caretWrappers[key];
        }
    }
    const setUserCaret = function(editorEl,sessionId, start, end){
        let R = Math.round(Math.random()*255);
        let G = Math.round(Math.random()*255);
        let B = Math.round(Math.random()*255);
        let rgba = "rgba("+R+", "+G+", "+B+", .6)";
        createCaret(sessionId, sessionId, rgba);
        calcUserCaret(editorEl, start, end, sessionId);
    }

    const calcUserCaret = function(element, start, end, key){
        let childTextLength = 0;
        let textNodeList = Caret.getTextNodeList(element);
        let startOffset = 0, endOffset = 0;
        let startElement, endElement;
        let countOfNewLine = 0;
        let isLast = false;
        CaretVis.removeDrags(key);
        textNodeList.forEach(function(textNode) {
            if(isLast){
                return;
            }
            let nodeTextLength = textNode.textContent.length;
            let lineNode = Caret.getLineNode(element, textNode);
            countOfNewLine = Caret.getCountOfNewLineOver(element, lineNode, countOfNewLine);
            endElement = null
            if(start <= childTextLength + countOfNewLine + nodeTextLength){
                startOffset = start - (childTextLength + countOfNewLine);
                if(startElement != null){
                    startOffset = 0;
                } 
                startElement = textNode;
            }
            if(end <= childTextLength + countOfNewLine + nodeTextLength){
                endOffset = end - (childTextLength + countOfNewLine);
                endElement = textNode;
                isLast = true;
            }
            
            if(startElement != null){
                if(endElement == null){
                    endElement = startElement;
                    endOffset = startElement.length;
                }
                try{
                    let createdRange = document.createRange();
                    createdRange.selectNodeContents(element);
                    createdRange.setStart(startElement, startOffset);
                    createdRange.setEnd(endElement, endOffset);
                    createDrag(key, createdRange.getBoundingClientRect(), element);
                }catch(e){
                    
                }
                
            }
            childTextLength += nodeTextLength;
        });
        let totalLength = childTextLength+countOfNewLine;

        if(totalLength < start){
            startElement = textNodeList[textNodeList.length - 1];
            startOffset = startElement.length;
            endElement = startElement;
            endOffset = startOffset;
        } else if(totalLength < end){
            endElement = textNodeList[textNodeList.length - 1];
            endOffset = endElement.length-1;
        }
        if (w3) {
            try{
                let createdRange = document.createRange();
                createdRange.selectNodeContents(element);
                createdRange.setStart(endElement, endOffset);
                createdRange.setEnd(endElement, endOffset);
                moveCaret(key, createdRange.getBoundingClientRect(), element);
            }
            catch(e){
                
            }
        }
        return null;
    }
    const caretVis = {
        init : init,
        createCaret : createCaret,
        moveCaret : moveCaret,
        createDrag : createDrag,
        removeDrags : removeDrags,
        removeCaret : removeCaret,
        setUserCaret : setUserCaret,
        calcUserCaret : calcUserCaret,
        getCaretWrappers : getCaretWrappers,
    }

    if (typeof define == 'function' && define.amd) {
        define(function(){
          return caretVis;
        });
    } else if (typeof module !== 'undefined') {
        module.exports = caretVis;
    } else {
        window.CaretVis = caretVis;
    }
})();