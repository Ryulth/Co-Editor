(function(){
    let startCaret;
    let endCaret;
    const getCaretPosition = function(element){
        return [getCaretPositionStart(element), getCaretPositionEnd(element)];
    }
    const getCaretPositionStart = function(element) {
        let position = 0;
        if (w3) {
            try{
            let range = window.getSelection().getRangeAt(0);
            let clonedRange = range.cloneRange();
            clonedRange.selectNodeContents(element);
            clonedRange.setEnd(range.startContainer, range.startOffset);
            position = clonedRange.toString().length;

            let lineNode = getLineNode(element, clonedRange.endContainer);

            position += getCountOfNewLine(element, lineNode);
            }
            catch(e){}
        } else if (ie) {
            let textRange = document.selection.createRange();
            let createdTextRange = document.body.createTextRange();
            createdTextRange.moveToElementText(element);
            createdTextRange.setStartPoint("StartToStart", textRange);
            position = createdTextRange.text.length;
        }
        position = (position < 0) ? 0 : position;
        return position;
    }

    const getCaretPositionEnd = function(element) {
        let position = 0;
        if (w3) {
            try{
            let range = window.getSelection().getRangeAt(0);
            let clonedRange = range.cloneRange();
            clonedRange.selectNodeContents(element);
            clonedRange.setEnd(range.endContainer, range.endOffset);
            position = clonedRange.toString().length;

            let lineNode = getLineNode(element, clonedRange.endContainer);

            position += getCountOfNewLine(element, lineNode);
            }catch(e){}
        } else if (ie) {
            var textRange = document.selection.createRange();
            var createdTextRange = document.body.createTextRange();
            createdTextRange.moveToElementText(element);
            createdTextRange.setStartPoint("StartToStart", textRange);
            position = createdTextRange.text.length;
        }
        position = (position < 0) ? 0 : position;
        return position;
    }

    const getLineNode = function(element, node){
        let lineNode = node;

        if(element == lineNode){
            return lineNode;
        }
        
        while((lineNode.parentNode.id != element.id) || (lineNode.parentNode.classList != element.classList)){
            lineNode = lineNode.parentNode;
        }
        
        return lineNode;
    }

    const getCountOfNewLine = function(element, lineNode) {
        return Array.prototype.slice.call(element.childNodes).indexOf(lineNode);
    }

    const getCountOfNewLineOver = function(element, lineNode, countOfNewLine) {
        let list = element.childNodes;
        while(lineNode != list[countOfNewLine]){
            countOfNewLine++;
        }
        return countOfNewLine;
    }

    const setCaretPosition = function(element, start, end){
        let childTextLength = 0;
        let textNodeList = getTextNodeList(element);
        let startOffset = 0, endOffset = 0;
        let startElement, endElement;
        let countOfNewLine = 0;
        let range = document.createRange();
        let sel = window.getSelection();

        textNodeList.forEach(function(textNode) {
            let nodeTextLength = textNode.textContent.length;
            let lineNode = getLineNode(element, textNode);
            countOfNewLine = getCountOfNewLineOver(element, lineNode, countOfNewLine);

            if(start <= childTextLength + countOfNewLine + nodeTextLength && startElement == null){
                startOffset = start - (childTextLength + countOfNewLine);
                startElement = textNode;
            }
            if(end <= childTextLength + countOfNewLine + nodeTextLength && endElement == null){
                endOffset = end - (childTextLength + countOfNewLine);
                endElement = textNode;
            }

            childTextLength += nodeTextLength;
        });

        let totalLength = childTextLength+countOfNewLine;

        if(totalLength < start){
            startElement = textNodeList[textNodeList.length - 1];
            startOffset = startElement.length;
            endElement = startElement;
            startOffset = startOffset;
        } else if(totalLength < end){
            endElement = textNodeList[textNodeList.length - 1];
            endOffset = endElement.length;
        }

        try{
        range.setStart(startElement, startOffset);
        range.setEnd(endElement, endOffset);
        }catch(e){}   
        sel.removeAllRanges();
        sel.addRange(range);
    }

    const getTextNodeList = function(element){
        let childNodeList = element.childNodes;
        let textNodeList = [];
        Array.prototype.slice.call(childNodeList).forEach(function(childElement){
            if(childElement.nodeType == Node.TEXT_NODE){
                textNodeList.push(childElement);
            } else if(childElement.nodeName == "BR"){
                textNodeList.push(childElement);
            }else{
                textNodeList = textNodeList.concat(getTextNodeList(childElement));
            }
        })
        return textNodeList;
    }
    const calcCaret = function (setDiffs,sc,ec){
        startCaret = sc;
        endCaret = ec;
        setDiffs.forEach(function (tempDiff,index,array){
            let startIdx = tempDiff[0];
            let inputString = tempDiff[1];
            let deleteString = tempDiff[2];
            if(inputString.length != 0 && deleteString.length != 0){
                // delete and insert case
                // delete 먼저하자
                // 드래그 안 된 경우
                if(startCaret == endCaret){
                    deleteNoDrag(startIdx, deleteString);
                    // insert 된 크기 만큼 뒤로 간다.
                    if(startCaret>startIdx){    
                        startCaret += inputString.length;
                        endCaret += inputString.length;
                    }
                }else{
                    // 드래그 인 경우
                    deleteDrag(startIdx, deleteString);
                    // 다음 insert 
                        // delete 과정으로 드래그했던게 풀렸을수도 있음 
                        // insert 
                    insertCalcCaret(startIdx, inputString);
                    }
                // }
            }else if(inputString.length != 0){
                // insert 
                insertCalcCaret(startIdx, inputString);
            } else{
                // delete
                deleteCalcCaret(startIdx, deleteString);
            }
        });
        return [startCaret,endCaret]
    }
    
    function insertCalcCaret(startIdx, inputString){
        // insert 
        if(startCaret == endCaret){
            // 드래그 안 된 경우
            if(startIdx < startCaret){
                // 내 위치보다 앞에서 쓴 경우 뒤로 밀린다.
                startCaret += inputString.length;
                endCaret += inputString.length;
            }
        }else{
            // 드래그 된 경우
            if(startCaret < startIdx && startIdx < endCaret){
                // 입력 값이 드래그 안에 있을 경우
                // 드래그 뒤로만 늘려주면 됨
                endCaret += inputString.length;
            } else if(startIdx <= startCaret){
                // 입력 값이 드래그 앞에서
                // 드래그 된 시작 끝을 둘다 이동해야됨
                startCaret += inputString.length;
                endCaret += inputString.length;
            }
        }
    }
    function deleteCalcCaret(startIdx, deleteString){
        if(startCaret == endCaret){
            deleteNoDrag(startIdx, deleteString);
        }else{
            deleteDrag(startIdx, deleteString);
        }
    }

    function deleteNoDrag(startIdx, deleteString){
        // 내 커서가 드래그 안 된 경우
        if(startIdx < startCaret){
            // 일단 지우는 위치가 나보다 앞인지 검사
            if(startCaret < startIdx + deleteString.length){
                // 내 위치까지 지운 경우
                startCaret = startIdx;
                endCaret = startIdx;
            }else{
                // 내 위치 왼쪽에서 지운경우
                startCaret -= deleteString.length;
                endCaret -= deleteString.length;
            }
        }
    }

    function deleteDrag(startIdx, deleteString){
        // 내 커서가 드래그인 경우
        if(startIdx < startCaret){
            // 지우는 위치가 내 커서보다 앞인경우
            if(startIdx + deleteString.length <= startCaret){
                // 내가 드래그 한거 앞까지 지우는 경우
                startCaret -= deleteString.length;
                endCaret -= deleteString.length;
            }else if(startCaret < startIdx + deleteString.length && 
                    startIdx + deleteString.length <= endCaret){
                // 내가 드래그 한거 안에 지우는 경우
                startCaret = startIdx;
                let end_offset = endCaret - (startIdx + deleteString.length)
                endCaret = startIdx + end_offset;
                }
            else if(endCaret < startIdx + deleteString.length){
                // 내가 드래그 한거 다 지우는 경우
                startCaret = startIdx;
                endCaret = startIdx;
            }
        }else if(startCaret <= startIdx && startIdx < endCaret){
            // 지우는 시작이 드래그 안에 부분 지우려고 할때
            let end_offset = endCaret - (startIdx + deleteString.length);
            if(0 <= end_offset){
                endCaret = startIdx + end_offset;
            }else{
                endCaret = startIdx;
            }
        }
    }
    const caret = {
        getCaretPosition : getCaretPosition,
        setCaretPosition : setCaretPosition,
        getTextNodeList : getTextNodeList,
        getCountOfNewLineOver : getCountOfNewLineOver,
        getLineNode : getLineNode,
        calcCaret : calcCaret
    };
    if (typeof define == 'function' && define.amd) {
        define(function(){
          return caret;
        });
      } else if (typeof module !== 'undefined') {
        module.exports = caret;
      } else {
        window.Caret = caret;
      }
})();