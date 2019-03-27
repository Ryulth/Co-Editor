const ie = (typeof document.selection != "undefined" && document.selection.type != "Control") && true;
const w3 = (typeof window.getSelection != "undefined") && true;
const baseUrl = "http://10.77.34.204:8080";
const docsId = 1;//location.href.substr(location.href.lastIndexOf('?') + 1);
const dmp = new diff_match_patch();
const inputType = /Trident/.test( navigator.userAgent ) ? 'textinput' : 'input';
const lastGC = document.createElement("p");
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
window.onload = function () {
    getDocs();
    editor = document.getElementById("mokkiTextPreview");
    //editor.appendChild(lastGC);
    let bar = document.getElementById("mokkiButtonBar");
    
    if (editor.addEventListener) {
        editor.addEventListener("keydown", keydownAction)
        bar.addEventListener("click",clickAction)
        editor.addEventListener("mouseup", mouseupAction);
        editor.addEventListener(inputType, inputAction);
        editor.addEventListener("keyup", getCaret);
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
    //console.log(tempCaret)
    startCaret = tempCaret[0];
    endCaret = tempCaret[1];
}
function getPivotCaret(){
    let tempCaret = getCaretPosition(editor);
    //console.log(tempCaret)
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
    inputText = event.data;
    if (synchronized) {
        sendPatch(prevText,editor.innerHTML);
    }
}
function sendPatch(prev,current) {
    
    let diff = dmp.diff_main(prev, current, true);
    dmp.diff_cleanupSemantic(diff);
    if ((diff.length > 1) || (diff.length == 1 && diff[0][0] != 0)) { // 1 이상이어야 변경 한 것이 있음
        let res = setDiff(diff)[0];
        if (!(Hangul.disassemble(res[2]).length == Hangul.disassemble(res[1]).length + 1) || (keycode == "Backspace" || keycode == "Delete")) {
            synchronized = false;
            let inputLength = (res[1].length ==0 ) ? 0 : res[1].length-1;
            let deleteLength =(res[2].length ==0 ) ? 0 : 1-res[2].length;
            let patch_list = dmp.patch_make(prev, current, diff);
            let patch_text = dmp.patch_toText(patch_list);
            sendContentPost(patch_text,inputLength,deleteLength);
            let text1 = document.getElementById('text2b').value;
            let results = dmp.patch_apply(patch_list, text1);
            document.getElementById('text2b').value = results[0];
            prevText = editor.innerHTML;
        }
        keycode = "";
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
                idx += element[1].length;
                break;
            case -1: // delete
                isCycle = true;
                deleteString = element[1];
                break;
            case 1: // insert
                isCycle = true;
                insertString = element[1];
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
            document.getElementById('text2b').value = content;
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
    });
}
function receiveContent(response_body) {
    let receiveSessionId = response_body.socketSessionId;
    let response_patcheInfos = response_body.patchInfos;
    let originText = editor.innerHTML;
    if (receiveSessionId == clientSessionId) {
        if(response_patcheInfos.length > 1){ // 꼬여서 다시 부를 떄
            let snapshotText = response_body.snapshotText;
            let snapshotVersion = response_body.snapshotVersion;
            let result = patchDocs(response_patcheInfos,snapshotText,snapshotVersion);
            if(originText != result){
                getCaret();
                console.log("꼬임?",snapshotVersion)
                console.log("처음",startCaret,endCaret)
                let diff = dmp.diff_main(originText, result, true);
                dmp.diff_cleanupSemantic(diff);        
                editor.innerHTML = result;
                calcCaret(diff)
                setCaretPosition(editor,startCaret,endCaret);
                console.log("나중",startCaret,endCaret)
            }   
        }
        else{
            clientVersion = response_patcheInfos[0].patchVersion;
        }
        synchronized = true;
        sendPatch(prevText,originText);
    } 
    if(receiveSessionId != clientSessionId && synchronized){
        //setPivotCaret();
        getCaret();
        console.log("처음",startCaret,endCaret)
        let result = patchDocs(response_patcheInfos,originText,clientVersion);
        let diff = dmp.diff_main(originText, result, true);
        dmp.diff_cleanupSemantic(diff);
        editor.innerHTML = result;        
        calcCaret(diff)
        setCaretPosition(editor,startCaret,endCaret);
        getCaret();
        console.log("나중",startCaret,endCaret)
        prevText = result;
        document.getElementById('text2b').value = result;
    }
}
function calcCaret(diff){
    let tempDiffs=setDiff(diff);
    tempDiffs.forEach(function (tempDiff,index,array){
        let startIdx = tempDiff[0];
        if(startIdx<startCaret){
            moveIdx = tempDiff[1].length-tempDiff[2].length
            if(tempDiff[1].length>1){
                console.log(tempDiff);
            }
            startCaret += moveIdx;
            endCaret +=moveIdx;
        }
    });
    
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
        if (clientVersion<item["patchVersion"] && clientVersion != 0){
           //calcCaret(item.startIdx,item.endIdx,patches[0].diffs)
        }
        if (index == (array.length -1) && patches.length != 0) {
            clientVersion = item["patchVersion"];
        }
        
    });
    let ms_end = (new Date).getTime();
    console.log("걸린시간",(ms_end - ms_start) /1000)
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
    return [getCaretPositionStart(element), getCaretPositionEnd(element)];
}

function getCaretPositionStart(element) {
    var caretOffset = 0;
    if (w3) {
        try{
        var range = window.getSelection().getRangeAt(0);
        var preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        caretOffset = preCaretRange.toString().length;
       
        let lineNode = getLineNode(element, preCaretRange.endContainer);

        caretOffset += countPrevBrTag(element, lineNode);
        }catch(e){}
    } else if (ie) {
        var textRange = document.selection.createRange();
        var preCaretTextRange = document.body.createTextRange();
        preCaretTextRange.moveToElementText(element);
        preCaretTextRange.setStartPoint("StartToStart", textRange);
        caretOffset = preCaretTextRange.text.length;
    }
    return caretOffset;
}

function getCaretPositionEnd(element) {
    var caretOffset = 0;
    if (w3) {
        try{
        var range = window.getSelection().getRangeAt(0);
        var preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        caretOffset = preCaretRange.toString().length;
       
        let lineNode = getLineNode(element, preCaretRange.endContainer);

        caretOffset += countPrevBrTag(element, lineNode);
        }catch(e){}
    } else if (ie) {
        var textRange = document.selection.createRange();
        var preCaretTextRange = document.body.createTextRange();
        preCaretTextRange.moveToElementText(element);
        preCaretTextRange.setStartPoint("StartToStart", textRange);
        caretOffset = preCaretTextRange.text.length;
    }
    return caretOffset;
}

function getLineNode(element, node){
    let lineNode = node;

    if(element == lineNode){
        return lineNode;
    }
    
    while(lineNode.parentNode.id != element.id){
        lineNode = lineNode.parentNode;
    }
    
    return lineNode;
}

function countPrevBrTag(element, lineNode) {
    let count = 0;
    let isFirstLine = true;
    let list = element.childNodes;
    for(idx in list){
        if(isFirstLine){ // 아직 첫번째 줄임
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
    let caretOffset = 0;
    textNodeList.forEach(textNode => {
        let nodeTextLength = textNode.textContent.length;
        let lineNode = getLineNode(element, textNode);
        caretOffset = countPrevBrTag(element, lineNode);
        
        if(start <= childTextLength + caretOffset + nodeTextLength && startElement == null){
            startOffset = start - (childTextLength + caretOffset);
            startElement = textNode;
        }
        if(end <= childTextLength + caretOffset + nodeTextLength && endElement == null){
            endOffset = end - (childTextLength + caretOffset);
            endElement = textNode;
            return;
        }
        
        childTextLength += nodeTextLength;
    });

    let range = document.createRange();
    try{
        range.setStart(startElement, startOffset);
        range.setEnd(endElement, endCaret);
    }catch(e){ 
        console.log(startElement,startElement)
        console.log(endElement,endElement)
        console.log("st",start)
        console.log("end",end)
        console.log(prevText)
        console.log(editor.innerHTML)
        console.log(e)
    }
    
    let sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

const getTextNodeList = function(element){
    let childNodeList = element.childNodes;
    let textNodeList = [];
    for(childElement of childNodeList){
        if(childElement.nodeType == Node.TEXT_NODE){
            textNodeList.push(childElement);
        } else if(childElement.nodeName == "BR"){
            textNodeList.push(childElement);
        }else{
            textNodeList.push(...getTextNodeList(childElement));
        }
    }
    return textNodeList;
}