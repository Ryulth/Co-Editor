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
    let rgba = "rgba("+R+", "+G+", "+B+", .6)";
    caretVis.createCaret(sessionId, sessionId, rgba);
    setUserCaret2(editor, start, end, sessionId);
}

const setUserCaret2 = function(element, start, end, key){
    let childTextLength = 0;
    let textNodeList = getTextNodeList(element);
    let startOffset = 0, endOffset = 0;
    let startElement, endElement;
    let countOfNewLine = 0;
    let isLast = false;
    caretVis.removeDrags(key);
    textNodeList.forEach(function(textNode) {
        if(isLast){
            return;
        }
        let nodeTextLength = textNode.textContent.length;
        let lineNode = getLineNode(element, textNode);
        countOfNewLine = getCountOfNewLine(element, lineNode);
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
                caretVis.createDrag(key, createdRange.getBoundingClientRect());
            }catch(e){

            }
            
        }
        childTextLength += nodeTextLength;
    });
    if (w3) {
        try{
            let createdRange = document.createRange();
            createdRange.selectNodeContents(element);
            createdRange.setStart(endElement, endOffset);
            createdRange.setEnd(endElement, endOffset);
            caretVis.moveCaret(key, createdRange.getBoundingClientRect());
        }
        catch(e){
            
        }
    }
    return null;
}
window.onload = function () {
    caretVis = new Caret();
    getDocs();
    editor = document.getElementById("mokkiTextPreview");
    let bar = document.getElementById("mokkiButtonBar");
    if (editor.addEventListener) {
        editor.addEventListener("keydown", keydownAction);
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

function testgetAccount(){
    getAccounts(baseUrl,"docs",docsId);
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
var pprevText;
function keydownAction(event){
    keycode = event.code;
    getCaret();
    if (synchronized) {
        prevText = editor.innerHTML;
    }
    pprevText = editor.innerHTML;
}

function inputAction(event){
    if (synchronized) {
        sendPatch(prevText,editor.innerHTML, true);
    } 
    else{
        let diff = dmp.diff_main(pprevText, editor.innerHTML, true);
        dmp.diff_cleanupSemantic(diff);
        if ((diff.length > 1) || (diff.length == 1 && diff[0][0] != 0)) { // 1 이상이어야 변경 한 것이 있음
            let res = setDiff(diff)[0];    
            if (!(Hangul.disassemble(res[2]).length == Hangul.disassemble(res[1]).length + 1) || (keycode == "Backspace" || keycode == "Delete")) {
                setHangulSelection(res)
            }
        }
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
        //console.log("한글",inputString,startCaret,endCaret)
        let isWriting = (startCaret == endCaret)? false : true;
        if(inputString.length == 2 ){//&& Hangul.isComplete(inputString[0])){
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
              
            }
        }
        endCaret = (startCaret == endCaret)? endCaret+1 : endCaret;
        //console.log("st",startCaret,"ed",endCaret)
        setCaretPosition(editor,startCaret,endCaret);
       // console.log("한글셋","sc",startCaret ,"ec",endCaret);
    }
}
function sendPatch(prev,current, isis) {
    // console.log("prev : ", prev);
    // console.log("current : ", current)
    let diff = dmp.diff_main(prev, current, true);
    dmp.diff_cleanupSemantic(diff);
    if ((diff.length > 1) || (diff.length == 1 && diff[0][0] != 0)) { // 1 이상이어야 변경 한 것이 있음
        let res = setDiff(diff)[0];    
        if (!(Hangul.disassemble(res[2]).length == Hangul.disassemble(res[1]).length + 1) || (keycode == "Backspace" || keycode == "Delete")) {
            //console.log("sendPatch : ", diff);
            if(isis){
                setHangulSelection(res)
            }
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
            //testgetAccount();
        }
    });
}
function connect() {
    let socket = new SockJS(baseUrl + '/docs-websocket');
    stompClient = Stomp.over(socket);
    stompClient.connect({}, function (frame) {
        clientSessionId = /\/([^\/]+)\/websocket/.exec(socket._transport.url)[1];
        setConnected(true);
        accountLogin(baseUrl,"docs",docsId,clientSessionId);
        stompClient.subscribe('/topic/docs' + "/" + docsId, function (content) {
            let response_body = JSON.parse(content.body);
            receiveContent(response_body) //
        });
        stompClient.subscribe('/topic/position/'+docsId, function(content){
            let contentBody = JSON.parse(content.body);
            if(contentBody.sessionId != clientSessionId){
                setUserCaret(contentBody.sessionId, contentBody.start, contentBody.end);
            }
        });
        stompClient.subscribe('/topic/docs/'+docsId+"/accounts", function(content){
            let accounts = JSON.parse(content.body);
            setAccountTable(accounts);
        });
        
    });
}
function setConnected(connected) {
    if (connected) {
        console.log("연결됨");
    } else {
        console.log("연결안됨");
    }
}
function receiveContent(response_body) {
    let receiveSessionId = response_body.socketSessionId;
    let response_patcheInfos = response_body.patchInfos;
    let originHTML = editor.innerHTML;
    let result;
    if (receiveSessionId == clientSessionId) {
        if(response_patcheInfos.length > 1){ // 꼬여서 다시 부를 떄
            let snapshotText = response_body.snapshotText;
            let snapshotVersion = response_body.snapshotVersion;
            result = patchDocs(response_patcheInfos,snapshotText,snapshotVersion);
            // console.log("originHTML : ", originHTML)
            // console.log("result : ", result)
            if(originHTML != result){
              //  console.log("과연>","sc",startCaret,"ec",endCaret)
                getCaret();
                //console.log("과연>","sc",startCaret,"ec",endCaret)
                if(startCaret == endCaret){
                  //  console.log("과연")
                }
                
                let diff = dmp.diff_main(prevText,originHTML, true);
                let patches = dmp.patch_make(diff);
                if(patches.length > 0){
                    // console.log("!!@$!$@!@$!@$!@$@!$@! : ", result);
                    result = dmp.patch_apply(patches, result)[0];
                    // console.log("!!@$!$@!@$!@$!@$@!$@!@@@@@@@@@@@@@ : ", result);
                }
                
                // console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>")
                // console.log("prevText : ", prevText);
                // console.log("result : ", result);
                diff = dmp.diff_main(originHTML, result, true);
                dmp.diff_cleanupSemantic(diff);        
                editor.innerHTML = result;
                calcCaret(diff);

                setCaretPosition(editor,startCaret,endCaret);
            }   
        }
        else{
            clientVersion = response_patcheInfos[0].patchVersion;
        }
        synchronized = true;
        sendPatch(prevText,originHTML, false);  
        if(result != null){
            prevText = result;
        }
    } 
    if(receiveSessionId != clientSessionId && synchronized){
        getCaret();
        // console.log("sss originHTML : ", originHTML)
        let result = patchDocs(response_patcheInfos,originHTML,clientVersion);
        let diff = dmp.diff_main(originHTML, result, true);
        dmp.diff_cleanupSemantic(diff);
        // console.log("sss result : ", result);
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
        let inputString = tempDiff[1];
        let deleteString = tempDiff[2]
        //console.log(index,"번째",tempDiff,"sc",startCaret ,"si", startIdx,"ec",endCaret);
        
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
        //console.log(index,"번째",tempDiff,"sc",startCaret ,"si", startIdx,"ec",endCaret);
        
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
//파일로 추출
function accountLogout(baseUrl,type,id,clientSessionId){
    let sendUrl =  baseUrl + "/" +type +"/" + id+"/accounts/"+clientSessionId;
    $.ajax({
        async: true, // false 일 경우 동기 요청으로 변경
        type: "DELETE",
        contentType: "application/json",
        url: sendUrl,
        success: function (response) {
        }
    });
}
function accountLogin(baseUrl,type,id,clientSessionId){
        let sendUrl =  baseUrl + "/" +type +"/" + id+"/accounts";
        let reqBody = {
            "clientSessionId": clientSessionId,
            "remoteAddress": ""
        }
        $.ajax({
            async: true, // false 일 경우 동기 요청으로 변경
            type: "POST",
            contentType: "application/json",
            url: sendUrl,
            data: JSON.stringify(reqBody),
            dataType: 'json',
            success: function (response) {
            }
        });
}
function getAccounts(baseUrl,type,id){
    let sendUrl =  baseUrl + "/" +type +"/" + id+"/accounts";
    $.ajax({
        type: "GET",
        cache: false,
        url: sendUrl,
        success: function (response) {
            console.log(JSON.parse(response))
            setAccountTable(JSON.parse(response));
        }
    });
}
function setAccountTable(accounts){
    tableBody = document.getElementById("accounts-table-body");
    totalRow = "";
    let currentCaretUser = {};
    Object.assign(currentCaretUser, caretVis.caretWrappers);
    accounts.forEach(function (account){
        row = "<tr><td>"+account.clientSessionId
        +"</td><td>"+account.remoteAddress
        +"</td></tr>";
        totalRow += row;
        if(account.clientSessionId in currentCaretUser){
            delete currentCaretUser[account.clientSessionId];
        }
    });

    Object.keys(currentCaretUser).forEach(key => {
        caretVis.removeCaret(key);
    });
    
    tableBody.innerHTML = totalRow;
}
/////////////
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
            // 내 위치 이전까지 지운경우
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