(function () {
    const LOCATION = {
        START: 'start',
        END: 'end'
    }

    function getStartAndEndCaretPosition(element) {
        return [getCaretPositionStart(element), getCaretPositionEnd(element)];
    }

    function getCaretPositionStart(element) {
        return getCaretPosition(element, LOCATION.START);
    }

    function getCaretPositionEnd(element) {
        return getCaretPosition(element, LOCATION.END);
    }

    function getCaretPosition(element, location) {
        let position = 0;
        if (w3) {
            try {
                const range = window.getSelection().getRangeAt(0);
                const clonedRange = range.cloneRange();

                clonedRange.selectNodeContents(element);
                if (location === LOCATION.START) {
                    clonedRange.setEnd(range.startContainer, range.startOffset);
                } else if (location === LOCATION.END) {
                    clonedRange.setEnd(range.endContainer, range.endOffset);
                } else {
                    throw 'Position Error!';
                }

                position = clonedRange.toString().length;

                position += getCountOfNewLine(element, getLineNode(element, clonedRange.endContainer));
            } catch (e) {
                // console.log(e);
            }
        } else if (ie) {
            const createdTextRange = document.body.createTextRange();
            createdTextRange.moveToElementText(element);
            createdTextRange.setStartPoint("StartToStart", document.selection.createRange());
            position = createdTextRange.text.length;
        }

        return (position < 0) ? 0 : position;
    }

    function getLineNode(element, node) {
        let lineNode = node;

        if (element === lineNode) {
            return lineNode;
        }

        while ((lineNode.parentNode.id !== element.id) || (lineNode.parentNode.classList !== element.classList)) {
            lineNode = lineNode.parentNode;
        }

        return lineNode;
    }

    function getCountOfNewLine(element, lineNode) {
        return Array.prototype.slice.call(element.childNodes).indexOf(lineNode);
    }

    function getCountOfNewLineOver(element, lineNode, countOfNewLine) {
        const list = element.childNodes;

        while (lineNode !== list[countOfNewLine]) {
            countOfNewLine++;
        }

        return countOfNewLine;
    }

    function setCaretPosition(element, start, end) {
        let childTextLength = 0, 
            startOffset = 0, 
            endOffset = 0,
            countOfNewLine = 0,
            startElement = null,
            endElement = null;

        const textNodeList = getTextNodeList(element), 
            range = document.createRange(),
            sel = window.getSelection();

        textNodeList.forEach(function (textNode) {
            const nodeTextLength = textNode.textContent.length;
            countOfNewLine = getCountOfNewLineOver(element, getLineNode(element, textNode), countOfNewLine);

            if (start <= childTextLength + countOfNewLine + nodeTextLength && (startElement === null || startElement === undefined)) {
                startOffset = start - (childTextLength + countOfNewLine);
                startElement = textNode;
            }
            if (end <= childTextLength + countOfNewLine + nodeTextLength && (endElement === null || endElement === undefined)) {
                endOffset = end - (childTextLength + countOfNewLine);
                endElement = textNode;
            }

            childTextLength += nodeTextLength;
        });

        const totalLength = childTextLength + countOfNewLine;

        if (totalLength < start) {
            console.log("벗어남 1")
            startElement = textNodeList[textNodeList.length - 1];
            startOffset = startElement.length;
            endElement = startElement;
            endOffset = startOffset;
        } else if (totalLength < end) {
            console.log("벗어남 2")
            endElement = textNodeList[textNodeList.length - 1];
            endOffset = endElement.length;
        }

        try {
            range.setStart(startElement, startOffset);
            range.setEnd(endElement, endOffset);
        } catch (e) {
            console.log(e);
        }

        sel.removeAllRanges();
        sel.addRange(range);
    }

    function getTextNodeList(element) {
        let textNodeList = [];

        Array.prototype.slice.call(element.childNodes).forEach(function (childElement) {
            if (childElement.nodeType === Node.TEXT_NODE) {
                textNodeList.push(childElement);
            } else if (childElement.nodeName === "BR") {
                textNodeList.push(childElement);
            } else {
                textNodeList = textNodeList.concat(getTextNodeList(childElement));
            }
        })

        return textNodeList;
    }

    function calcCaret(diff, startCaret, endCaret) {
        diff.forEach(function (tempDiff, _, _) {
            const startIdx = tempDiff[0];
            const inputString = tempDiff[1];
            const deleteString = tempDiff[2];
            if (inputString.length !== 0 && deleteString.length !== 0) {
                // delete and insert case
                // delete 먼저하자
                // 드래그 안 된 경우
                
                if (startCaret === endCaret) {
                    [startCaret, endCaret] = deleteNoDrag(startIdx, deleteString, startCaret, endCaret);
                    // insert 된 크기 만큼 뒤로 간다.
                    if (startCaret > startIdx) {
                        startCaret += inputString.length;
                        endCaret += inputString.length;
                    }
                } else {
                    // 드래그 인 경우
                    [startCaret, endCaret] = deleteDrag(startIdx, deleteString, startCaret, endCaret);
                    // 다음 insert 
                    // delete 과정으로 드래그했던게 풀렸을수도 있음 
                    // insert 
                    [startCaret, endCaret] = insertCalcCaret(startIdx, inputString, startCaret, endCaret);
                }
                // }
            } else if (inputString.length !== 0) {
                // insert 
                [startCaret, endCaret] = insertCalcCaret(startIdx, inputString, startCaret, endCaret);
            } else {
                // delete
                [startCaret, endCaret] = deleteCalcCaret(startIdx, deleteString, startCaret, endCaret);
            }
        });
        return [startCaret, endCaret]
    }

    function insertCalcCaret(startIdx, inputString, startCaret, endCaret) {
        // insert 
        if (startCaret === endCaret) {
            // 드래그 안 된 경우
            if (startIdx < startCaret) {
                // 내 위치보다 앞에서 쓴 경우 뒤로 밀린다.
                startCaret += inputString.length;
                endCaret += inputString.length;
            }
        } else {
            // 드래그 된 경우
            if (startCaret < startIdx && startIdx < endCaret) {
                // 입력 값이 드래그 안에 있을 경우
                // 드래그 뒤로만 늘려주면 됨
                endCaret += inputString.length;
            } else if (startIdx <= startCaret) {
                // 입력 값이 드래그 앞에서
                // 드래그 된 시작 끝을 둘다 이동해야됨
                startCaret += inputString.length;
                endCaret += inputString.length;
            }
        }
        return [startCaret, endCaret]
    }

    function deleteCalcCaret(startIdx, deleteString, startCaret, endCaret) {
        if (startCaret === endCaret) {
            return deleteNoDrag(startIdx, deleteString, startCaret, endCaret);
        } else {
            return deleteDrag(startIdx, deleteString, startCaret, endCaret);
        }
    }

    function deleteNoDrag(startIdx, deleteString, startCaret, endCaret) {
        // 내 커서가 드래그 안 된 경우
        if (startIdx < startCaret) {
            // 일단 지우는 위치가 나보다 앞인지 검사
            if (startCaret < startIdx + deleteString.length) {
                // 내 위치까지 지운 경우
                startCaret = startIdx;
                endCaret = startIdx;
            } else {
                // 내 위치 왼쪽에서 지운경우
                startCaret -= deleteString.length;
                endCaret -= deleteString.length;
            }
        }
        return [startCaret, endCaret]
    }

    function deleteDrag(startIdx, deleteString, startCaret, endCaret) {
        // 내 커서가 드래그인 경우
        if (startIdx < startCaret) {
            // 지우는 위치가 내 커서보다 앞인경우
            if (startIdx + deleteString.length <= startCaret) {
                // 내가 드래그 한거 앞까지 지우는 경우
                startCaret -= deleteString.length;
                endCaret -= deleteString.length;
            } else if (startCaret < startIdx + deleteString.length &&
                startIdx + deleteString.length <= endCaret) {
                // 내가 드래그 한거 안에 지우는 경우
                startCaret = startIdx;
                let end_offset = endCaret - (startIdx + deleteString.length)
                endCaret = startIdx + end_offset;
            }
            else if (endCaret < startIdx + deleteString.length) {
                // 내가 드래그 한거 다 지우는 경우
                startCaret = startIdx;
                endCaret = startIdx;
            }
        } else if (startCaret <= startIdx && startIdx < endCaret) {
            // 지우는 시작이 드래그 안에 부분 지우려고 할때
            let end_offset = endCaret - (startIdx + deleteString.length);
            if (0 <= end_offset) {
                endCaret = startIdx + end_offset;
            } else {
                endCaret = startIdx;
            }
        }
        return [startCaret, endCaret]
    }

    const caret = {
        getCaretPosition: getStartAndEndCaretPosition,
        setCaretPosition: setCaretPosition,
        getTextNodeList: getTextNodeList,
        getCountOfNewLineOver: getCountOfNewLineOver,
        getLineNode: getLineNode,
        calcCaret: calcCaret
    };

    if (typeof define === 'function' && define.amd) {
        define(function () {
            return caret;
        });
    } else if (typeof module !== 'undefined') {
        module.exports = caret;
    } else {
        window.Caret = caret;
    }
})();