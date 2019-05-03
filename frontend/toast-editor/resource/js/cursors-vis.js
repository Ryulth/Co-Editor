(function(){
    let caretContainer;
    const caretWrappers = {};

    function getCaretWrappers(){
        return caretWrappers;
    };

    function getCaretContainer(){
        return caretContainer;
    }

    function getCreatedCursorWrapper(color){
        const cursorWrapper = document.createElement("SPAN");
        const caretCursorElement = document.createElement("SPAN");
        cursorWrapper.classList.add("caret-cursors-wrapper");
        caretCursorElement.classList.add("caret-cursors");
        caretCursorElement.style.backgroundColor = color;
        cursorWrapper.appendChild(caretCursorElement)
        return cursorWrapper;
    };
    
    function getCreatedCaretFlag(name, color){
        const caretFlag = document.createElement("DIV");
        const caretName = document.createElement("SMALL");
        caretFlag.classList.add("caret-flag");
        caretFlag.style.backgroundColor = color;
        caretFlag.appendChild(caretName);
        caretName.classList.add("caret-name");
        caretName.innerText = name;
        return caretFlag;
    };

    function init(){
        caretContainer = document.createElement("DIV");
        caretContainer.classList.add("caret-container");
        document.body.appendChild(caretContainer);
    };

    function createCaret(key, value, color){
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

    function moveCaret(key, rect, editorScroll){
        let scrollHeight = 0;
        if(editorScroll.scrollHeight === editorScroll.clientHeight){
            scrollHeight = caretContainer.offsetTop;
        }
        if(key in caretWrappers){
            const caretWrapper = document.querySelector(`#container-${key}`).querySelector(".caret-wrapper");
            caretWrapper.style.top = `${rect.top+editorScroll.scrollTop-scrollHeight}px`;
            caretWrapper.style.left = `${rect.left}px`;
            caretWrapper.style.height = `${rect.height}px`;
        }
    };

    function createDrag(key, rect, editorScroll){
        let scrollHeight = 0;
        if(editorScroll.scrollHeight === editorScroll.clientHeight){
            scrollHeight = caretContainer.offsetTop;
        }
        const caretFrame = document.querySelector(`#container-${key}`);
        const caretDrag = document.createElement("SPAN");
        caretDrag.classList.add("caret-drags");
        caretDrag.style.top = rect.top+editorScroll.scrollTop-scrollHeight+"px";
        caretDrag.style.left = `${rect.left}px`;
        caretDrag.style.width = `${rect.width}px`;
        caretDrag.style.height = `${rect.height}px`;
        caretDrag.style.backgroundColor = getComputedStyle(caretFrame.querySelector(".caret-cursors")).backgroundColor;
        caretFrame.appendChild(caretDrag);
    };

    function removeDrags(key){
        Array.prototype.slice.call(
            document.querySelector(`#container-${key}`).querySelectorAll(".caret-drags")).forEach(function(element) {
            element.remove();
        });
    };

    function removeCaret(key){
        if(key in caretWrappers){
            const caretWrapper = document.querySelector(`#container-${key}`).querySelector(".caret-wrapper");
            caretWrapper.remove();
            delete caretWrappers[key];
        }
    }
    function setUserCaret(editorEl, editorScroll, sessionId, start, end){
        const R = Math.round(Math.random()*255);
        const G = Math.round(Math.random()*255);
        const B = Math.round(Math.random()*255);
        const rgba = `rgba(${R}, ${G}, ${B}, .6)`;
        createCaret(sessionId, sessionId, rgba);
        calcUserCaret(editorEl, editorScroll, start, end, sessionId);
    }

    function calcUserCaret(element, editorScroll, start, end, key){
        let childTextLength = 0;
        const textNodeList = Caret.getTextNodeList(element);
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
                if(startElement !== undefined && startElement !== null){
                    startOffset = 0;
                } 
                startElement = textNode;
            }
            if(end <= childTextLength + countOfNewLine + nodeTextLength){
                endOffset = end - (childTextLength + countOfNewLine);
                endElement = textNode;
                isLast = true;
            }
            
            if(startElement !== undefined && startElement !== null){
                if(endElement === undefined || endElement === null){
                    endElement = startElement;
                    endOffset = startElement.length;
                }
                try{
                    let createdRange = document.createRange();
                    createdRange.selectNodeContents(element);
                    createdRange.setStart(startElement, startOffset);
                    createdRange.setEnd(endElement, endOffset);
                    createDrag(key, createdRange.getBoundingClientRect(), editorScroll);
                }catch(e){
                    
                }
                
            }
            childTextLength += nodeTextLength;
        });
        const totalLength = childTextLength+countOfNewLine;

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
                moveCaret(key, createdRange.getBoundingClientRect(), editorScroll);
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
        getCaretContainer : getCaretContainer
    }

    if (typeof define === 'function' && define.amd) {
        define(function(){
          return caretVis;
        });
    } else if (typeof module !== 'undefined') {
        module.exports = caretVis;
    } else {
        window.CaretVis = caretVis;
    }
})();