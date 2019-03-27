const ie = (typeof document.selection != "undefined" && document.selection.type != "Control") && true;
const w3 = (typeof window.getSelection != "undefined") && true;

const getCaretPosition = function(element){
    return [getCaretPositionStart(element), getCaretPositionEnd(element)];
}

const getCaretPositionStart = function(element) {
    let position = 0;
    if (w3) {
        let range = window.getSelection().getRangeAt(0);
        let clonedRange = range.cloneRange();
        clonedRange.selectNodeContents(element);
        clonedRange.setEnd(range.startContainer, range.startOffset);
        position = clonedRange.toString().length;

        let lineNode = getLineNode(element, clonedRange.endContainer);

        position += getCountOfNewLine(element, lineNode);
    } else if (ie) {
        let textRange = document.selection.createRange();
        let createdTextRange = document.body.createTextRange();
        createdTextRange.moveToElementText(element);
        createdTextRange.setStartPoint("StartToStart", textRange);
        position = createdTextRange.text.length;
    }
    return position;
}

const getCaretPositionEnd = function(element) {
    let position = 0;
    if (w3) {
        let range = window.getSelection().getRangeAt(0);
        let clonedRange = range.cloneRange();
        clonedRange.selectNodeContents(element);
        clonedRange.setEnd(range.endContainer, range.endOffset);
        position = clonedRange.toString().length;

        let lineNode = getLineNode(element, clonedRange.endContainer);

        position += getCountOfNewLine(element, lineNode);
    } else if (ie) {
        var textRange = document.selection.createRange();
        var createdTextRange = document.body.createTextRange();
        createdTextRange.moveToElementText(element);
        createdTextRange.setStartPoint("StartToStart", textRange);
        position = createdTextRange.text.length;
    }
    return position;
}

const getLineNode = function(element, node){
    let lineNode = node;

    if(element == lineNode){
        return lineNode;
    }

    while(lineNode.parentNode.id != element.id){
        lineNode = lineNode.parentNode;
    }

    return lineNode;
}

const getCountOfNewLine = function(element, lineNode) {
    let count = 0;
    let isFirstLine = true;
    let list = element.childNodes;
    for(idx in list){
        if(isFirstLine){
            if(list[idx].nodeName == "DIV" || list[idx].nodeName == "P"){
                isFirstLine = false;
                count += 1;
            }
            if(list[idx] == lineNode){
                break;
            }
        }else{
            count += 1;
            if(list[idx] == lineNode){
                break;
            }
        }
    }
    return count;
}

const setCaretPosition = function(element, start, end){
    let childTextLength = 0;
    let textNodeList = getTextNodeList(element);
    let startCaret = 0, endCaret = 0;
    let startElement, endElement;
    let countOfNewLine = 0;
    let range = document.createRange();
    let sel = window.getSelection();

    textNodeList.forEach(function(textNode) {
        let nodeTextLength = textNode.textContent.length;
        let lineNode = getLineNode(element, textNode);
        countOfNewLine = getCountOfNewLine(element, lineNode);

        if(start <= childTextLength + countOfNewLine + nodeTextLength && startElement == null){
            startCaret = start - (childTextLength + countOfNewLine);
            startElement = textNode;
        }
        if(end <= childTextLength + countOfNewLine + nodeTextLength && endElement == null){
            endCaret = end - (childTextLength + countOfNewLine);
            endElement = textNode;
            return;
        }

        childTextLength += nodeTextLength;
    });

    range.setStart(startElement, startCaret);
    range.setEnd(endElement, endCaret);
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