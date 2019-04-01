const ie = (typeof document.selection != "undefined" && document.selection.type != "Control") && true;
const w3 = (typeof window.getSelection != "undefined") && true;
const baseUrl = "http://10.77.34.204:8080";
const docsId = 1;//location.href.substr(location.href.lastIndexOf('?') + 1);
const dmp = new diff_match_patch();
const inputType = /Trident/.test( navigator.userAgent ) ? 'textinput' : 'input';
let editor;
let synchronized = true; 
let clientVersion;
let stompClient;
let clientSessionId;
let prevText;
let pivotStartCaret = 0;
let pivotEndCaret = 0;
let startCaret =0;
let endCaret =0;
let keycode = "";
let caretVis;

const setUserCaret = function(sessionId, start, end){
    let R = Math.round(Math.random()*255);
    let G = Math.round(Math.random()*255);
    let B = Math.round(Math.random()*255);
    let rgba = "rgba("+R+", "+G+", "+B+", .4)";
    let rect =  getRangeBoundRect(editor, start, start);
    if(rect != null){
        caretVis.createCaret(sessionId, sessionId, rgba);
        caretVis.moveCaret(sessionId, rect);
    }
}

window.onload = function () {
    caretVis = new Caret();
    getDocs();
    editor = document.getElementById("mokkiTextPreview");
    let bar = document.getElementById("mokkiButtonBar");
    
    if (editor.addEventListener) {
        editor.addEventListener("keydown", keydownAction)
        bar.addEventListener("click",clickAction)
        editor.addEventListener("mouseup", mouseupAction);
        editor.addEventListener(inputType, inputAction);
        editor.addEventListener("keyup", keyupAction);
    }/*
    else {
        editor.attachEvent("onkeydown", keydownAction)
        bar.attachEvent("onclick",clickAction)
        editor.attachEvent("oninput", attachEvent);
    }*/    
}
function mouseupAction(){
    getCaret();
}
function getCaret(){
    let tempCaret = getCaretPosition(editor);
    startCaret = tempCaret[0];
    endCaret = tempCaret[1];
    stompClient.send('/topic/position/'+docsId, {}, JSON.stringify({sessionId: clientSessionId, start: startCaret, end: endCaret}));
}
function getPivotCaret(){
    let tempCaret = getCaretPosition(editor);
    pivotStartCaret = tempCaret[0];
    pivotEndCaret = tempCaret[1];
}
function clickAction(){
    getCaret();
 
    if(synchronized){
        prevText = editor.innerHTML;
    }
}
function keydownAction(event){
    keycode = event.code;
    getCaret();
    if (synchronized) {
        prevText = editor.innerHTML;
    }
}

function inputAction(event){
    if (synchronized) {
        sendPatch(prevText,editor.innerHTML);
    }
}
function keyupAction(){
    getCaret();
}
function setHangulSelection(resDiff){
    let startIdx = resDiff[0];
    let inputString = resDiff[1].trim();
    let deleteString = resDiff[2].trim();
    if(isHangul(inputString)){
        console.log("한글",inputString,startCaret,endCaret)
        let isWriting = (startCaret == endCaret)? false : true;
        if(inputString.length == 2 ){
            startCaret +=1;
            endCaret+=1;
        }
        else{
            if(isWriting && !Hangul.isCompleteAll(inputString)){
                if(Hangul.isCho(inputString)||Hangul.isVowel(inputString)){
                    if(endCaret-startCaret>1){
                        endCaret+=(1-deleteString.length);                
                    }
                    else{
                    startCaret +=(1-deleteString.length);
                    endCaret+=(1-deleteString.length);
                    }
                }
            }
            else{
                console.log("쵸여기",resDiff);
            }
        }
        endCaret = (startCaret == endCaret)? endCaret+1 : endCaret;
        console.log("st",startCaret,"ed",endCaret)
        setCaretPosition(editor,startCaret,endCaret);
    }
}
function sendPatch(prev,current) {
    
    let diff = dmp.diff_main(prev, current, true);
    dmp.diff_cleanupSemantic(diff);
    if ((diff.length > 1) || (diff.length == 1 && diff[0][0] != 0)) { // 1 이상이어야 변경 한 것이 있음
        let res = setDiff(diff)[0];    
        if (!(Hangul.disassemble(res[2]).length == Hangul.disassemble(res[1]).length + 1) || (keycode == "Backspace" || keycode == "Delete")) {
            setHangulSelection(res)
            synchronized = false;
            let inputLength = (res[1].length ==0 ) ? 0 : res[1].length-1;
            let deleteLength =(res[2].length ==0 ) ? 0 : 1-res[2].length;
            let patch_list = dmp.patch_make(prev, current, diff);
            let patch_text = dmp.patch_toText(patch_list);
            sendContentPost(patch_text,inputLength,deleteLength);
            //let text1 = document.getElementById('text2b').value;
            //let results = dmp.patch_apply(patch_list, text1);
            //document.getElementById('text2b').value = results[0];
            prevText = editor.innerHTML;
        }
        keycode = "";
    }
    else{
        //TODO 변경한거 없다고 잡는 경우가 있다 제자리 변경 그경우 고려해야함        console.log(diff)
    }
}
function sendContentPost(patchText,inputLength,deleteLength) {
    let reqBody = {
        "socketSessionId": clientSessionId,
        "docsId": docsId,
        "clientVersion": clientVersion,
        "patchText": patchText ,
        "startIdx" : startCaret -inputLength,
        "endIdx" : endCaret + deleteLength
    }
    $.ajax({
        async: true, // false 일 경우 동기 요청으로 변경
        type: "POST",
        contentType: "application/json",
        url: baseUrl + "/docs/" + docsId,
        data: JSON.stringify(reqBody),
        dataType: 'json',
        success: function (response) {
        }
    });
}
function setDiff(diff) {
    let idx = 0;
    let insertString = "";
    let deleteString = "";
    let isCycle = false;
    let res = [];
    diff.forEach(function (element) {
        switch (element[0]) {
            case 0: // retain
                if (isCycle) {
//                    return [idx, insertString, deleteString]
                    isCycle = false;
                    res.push([idx, insertString, deleteString]);
                    insertString = "";
                    deleteString = "";
                }
                idx += removeTags(element[1]).length;
                break;
            case -1: // delete
                isCycle = true;
                deleteString = removeTags(element[1]);
                break;
            case 1: // insert
                isCycle = true;
                insertString = removeTags(element[1]);
                break;
        }
    });
    if (isCycle) {
        res.push([idx, insertString, deleteString])
        
    }
    return res;
    //return [idx, insertString, deleteString]
}


function getDocs() {
    $.ajax({
        type: "GET",
        url: baseUrl + "/docs/" + docsId,
        cache: false,
        success: function (response) {
            let response_body = JSON.parse(response);
            let response_doc = response_body["docs"];
            let content = response_doc["content"];
            clientVersion = response_doc["version"];
            let response_patches = response_body["patchInfos"];
            if (response_patches.length >= 1) {
                console.log(response_patches);
                console.log(response_doc);
                content = patchDocs(response_patches,content,clientVersion);
            } 
            document.getElementById("mokkiTextPreview").innerHTML = content;
           // document.getElementById("mokkiTextPreview").appendChild(lastGC);
            prevText = content;
            synchronized = true;
           // document.getElementById('text2b').value = content;
            connect();
        }
    });
}
function connect() {
    let socket = new SockJS(baseUrl + '/docs-websocket');
    stompClient = Stomp.over(socket);
    stompClient.connect({}, function (frame) {
        setConnected(true);
        //console.log("Connected" + frame);
        clientSessionId = /\/([^\/]+)\/websocket/.exec(socket._transport.url)[1];
        stompClient.subscribe('/topic/docs' + "/" + docsId, function (content) {
            response_body = JSON.parse(content.body);
            receiveContent(response_body) //
        });
        stompClient.subscribe('/topic/position/'+docsId, function(content){
            let contentBody = JSON.parse(content.body);
            console.log(contentBody)
            if(contentBody.sessionId != clientSessionId){
                setUserCaret(contentBody.sessionId, contentBody.start, contentBody.end);
            }
        });
    });
}
function receiveContent(response_body) {
    let receiveSessionId = response_body.socketSessionId;
    let response_patcheInfos = response_body.patchInfos;
    let originHTML = editor.innerHTML;
    if (receiveSessionId == clientSessionId) {
        if(response_patcheInfos.length > 1){ // 꼬여서 다시 부를 떄
            let snapshotText = response_body.snapshotText;
            let snapshotVersion = response_body.snapshotVersion;
            let result = patchDocs(response_patcheInfos,snapshotText,snapshotVersion);
            if(originHTML != result){
                getCaret();
                let diff = dmp.diff_main(originHTML, result, true);
                dmp.diff_cleanupSemantic(diff);        
                editor.innerHTML = result;
                calcCaret(diff)
                setCaretPosition(editor,startCaret,endCaret);
            }   
        }
        else{
            clientVersion = response_patcheInfos[0].patchVersion;
        }
        synchronized = true;
        sendPatch(prevText,originHTML);
    } 
    if(receiveSessionId != clientSessionId && synchronized){
        getCaret();
        let result = patchDocs(response_patcheInfos,originHTML,clientVersion);
        let diff = dmp.diff_main(originHTML, result, true);
        dmp.diff_cleanupSemantic(diff);
        editor.innerHTML = result;        
        calcCaret(diff)
        setCaretPosition(editor,startCaret,endCaret);
        prevText = result;
        //document.getElementById('text2b').value = result;
    }
}
function calcCaret(diff){
    let tempDiffs=setDiff(diff);
    tempDiffs.forEach(function (tempDiff,index,array){
        let startIdx = tempDiff[0];
        let moveIdx = tempDiff[1].length-tempDiff[2].length;
        let endIdx = startIdx - moveIdx;
//      console.log(tempDiff,"si",startIdx,"ei",endIdx)
//      console.log(startCaret)
        if(startIdx<=startCaret && endIdx<=startCaret){
            if(tempDiff[1].length>1){
            }
            console.log("저기")
            startCaret += moveIdx;
            endCaret +=moveIdx;
        }
        else if(startIdx<=startCaret && startCaret< endIdx){
            console.log("요기")
            startCaret = startIdx;
            endCaret =startIdx;
        }
        else if(startCaret<=startIdx && startIdx <= endCaret){
            console.log("쩌기")
            endCaret +=moveIdx;
        }
        else{
            console.log(tempDiff)
            console.log("si",startIdx,"ei",endIdx)
            console.log("startCaret",startCaret,"endCaret",endCaret)
            console.log("else")
        }
    });
}
function removeTags(text){
    let resText = text.replace(/<\p>/ig, " "); //엔터에 대한 계산위한용도
    resText = resText.replace("&nbsp;"," ");
    resText = resText.replace(/<(\/)?([a-zA-Z]*)(\s[a-zA-Z]*=[^>]*)?(\s)*(\/)?>/ig, "");
    return resText;
}
function patchDocs(response_patches,content,startClientVersion) {
    let result = content;
    let ms_start = (new Date).getTime();
    response_patches.forEach(function (item, index, array) {
        let patches = dmp.patch_fromText(item["patchText"]);
        if (startClientVersion < item["patchVersion"]) {
            let results = dmp.patch_apply(patches, result);
            result = results[0];
            startClientVersion += 1;
        }
        if (index == (array.length -1) && patches.length != 0) {
            clientVersion = item["patchVersion"];
        }
        
    });
    let ms_end = (new Date).getTime();
    //console.log("걸린시간",(ms_end - ms_start) /1000)
    return result;
}
function disconnect() {
    if (stompClient !== null) {
        stompClient.disconnect();
    }
    setConnected(false);
    console.log("Disconnected");
}

function setConnected(connected) {
    if (connected) {
        console.log("연결됨");
    } else {
        console.log("연결안됨");
    }
}
function isHangul(inputText){
    if(inputText==null){
        return false;
    }
    if(escape(inputText.charAt(0)).length == 6){
        return true;
    }
    return false;
}


//////커서
const getCaretPosition = function(element){
    //document.getElementById("caretBegin").innerText = getCaretPositionStart(element);
    //document.getElementById("caretEnd").innerText = getCaretPositionEnd(element);
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
    let startOffset = 0, endOffset = 0;
    let startElement, endElement;
    let countOfNewLine = 0;
    let range = document.createRange();
    let sel = window.getSelection();

    textNodeList.forEach(function(textNode) {
        let nodeTextLength = textNode.textContent.length;
        let lineNode = getLineNode(element, textNode);
        countOfNewLine = getCountOfNewLine(element, lineNode);

        if(start <= childTextLength + countOfNewLine + nodeTextLength && startElement == null){
            startOffset = start - (childTextLength + countOfNewLine);
            startElement = textNode;
        }
        if(end <= childTextLength + countOfNewLine + nodeTextLength && endElement == null){
            endOffset = end - (childTextLength + countOfNewLine);
            endElement = textNode;
            return;
        }

        childTextLength += nodeTextLength;
    });
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

const getRangeBoundRect = function(element, start, end){
    let childTextLength = 0;
    let textNodeList = getTextNodeList(element);
    let startOffset = 0, endOffset = 0;
    let startElement, endElement;
    let countOfNewLine = 0;

    textNodeList.forEach(function(textNode) {
        let nodeTextLength = textNode.textContent.length;
        let lineNode = getLineNode(element, textNode);
        countOfNewLine = getCountOfNewLine(element, lineNode);

        if(start <= childTextLength + countOfNewLine + nodeTextLength && startElement == null){
            startOffset = start - (childTextLength + countOfNewLine);
            startElement = textNode;
        }
        if(end <= childTextLength + countOfNewLine + nodeTextLength && endElement == null){
            endOffset = end - (childTextLength + countOfNewLine);
            endElement = textNode;
            return;
        }

        childTextLength += nodeTextLength;
    });

    if (w3) {
        try{
            let range = window.getSelection().getRangeAt(0);
            let clonedRange = range.cloneRange();
            clonedRange.selectNodeContents(element);
            clonedRange.setStart(startElement, startOffset);
            clonedRange.setEnd(endElement, endOffset);
            return clonedRange.getBoundingClientRect();
        }
        catch(e){}
    }
    return null;
}