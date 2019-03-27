var ie = (typeof document.selection != "undefined" && document.selection.type != "Control") && true;
var w3 = (typeof window.getSelection != "undefined") && true;

const getCaretPosition = function(element){
    return [getCaretPositionStart(element), getCaretPositionEnd(element)];
}

const getCaretPositionStart = function(element) {
    var caretOffset = 0;
    if (w3) {
        var range = window.getSelection().getRangeAt(0);
        var preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        caretOffset = preCaretRange.toString().length;

        let lineNode = getLineNode(element, preCaretRange.endContainer);

        caretOffset += countPrevBrTag(element, lineNode);
    } else if (ie) {
        var textRange = document.selection.createRange();
        var preCaretTextRange = document.body.createTextRange();
        preCaretTextRange.moveToElementText(element);
        preCaretTextRange.setStartPoint("StartToStart", textRange);
        caretOffset = preCaretTextRange.text.length;
    }
    return caretOffset;
}

const getCaretPositionEnd = function(element) {
    var caretOffset = 0;
    if (w3) {
        var range = window.getSelection().getRangeAt(0);
        var preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        caretOffset = preCaretRange.toString().length;

        let lineNode = getLineNode(element, preCaretRange.endContainer);

        caretOffset += countPrevBrTag(element, lineNode);
    } else if (ie) {
        var textRange = document.selection.createRange();
        var preCaretTextRange = document.body.createTextRange();
        preCaretTextRange.moveToElementText(element);
        preCaretTextRange.setStartPoint("StartToStart", textRange);
        caretOffset = preCaretTextRange.text.length;
    }
    return caretOffset;
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

const countPrevBrTag = function(element, lineNode) {
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
    let caretOffset = 0;

    textNodeList.forEach(function(textNode) {
        let nodeTextLength = textNode.textContent.length;
        let lineNode = getLineNode(element, textNode);
        caretOffset = countPrevBrTag(element, lineNode);

        if(start <= childTextLength + caretOffset + nodeTextLength && startElement == null){
            startCaret = start - (childTextLength + caretOffset);
            startElement = textNode;
        }
        if(end <= childTextLength + caretOffset + nodeTextLength && endElement == null){
            endCaret = end - (childTextLength + caretOffset);
            endElement = textNode;
            return;
        }

        childTextLength += nodeTextLength;
    });

    let range = document.createRange();
    range.setStart(startElement, startCaret);
    range.setEnd(endElement, endCaret);
    let sel = window.getSelection();
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