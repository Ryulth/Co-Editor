let ie = (typeof document.selection != "undefined" && document.selection.type != "Control") && true;
let w3 = (typeof window.getSelection != "undefined") && true;

const baseUrl = "http://10.77.34.204:8080";
let editor;
let inputTag;

let prev = "";
let keycode = "";
let keydata = "";

let docsId = 3; //location.href.substr(location.href.lastIndexOf('?') + 1);
let receiveFlag = true;
let synchronized = true;
let clientVersion;
let serverVersion;
let stompClient;
let clientSessionId;
let prevSet = []; // idx 0 = version 1 = text
let dmp = new diff_match_patch();
let prevNode;
let myCaret;
let startCaret;
let endCaret;
let inputType = /Trident/.test( navigator.userAgent ) ? 'textinput' : 'input';
let text_node_list = [];
let inputText
getDocs();

window.onload = function () {
    connect();
    editor = document.getElementById("mokkiTextPreview");
    let bar = document.getElementById("mokkiButtonBar");
    
    if (editor.addEventListener) {
        editor.addEventListener("keydown", keydownAction)
        bar.addEventListener("click",clickAction)
        editor.addEventListener("mouseup", setCaret);
        editor.addEventListener(inputType, inputAction);
        editor.addEventListener("keyup", setCaret);
    }/*
    else {
        editor.attachEvent("onkeydown", keydownAction)
        bar.attachEvent("onclick",clickAction)
        editor.attachEvent("oninput", attachEvent);
    }*/
    
}
function clickAction(){
    setCaret();
    if(synchronized){
        prev = editor.innerHTML;
    }
}
function keydownAction(event){
    keycode = event.code;
    setCaret();
    if (synchronized) {
        prev = editor.innerHTML;
    }
}

function inputAction(event){
    inputText = event.data;
    //myCaret = getCaretPosition(editor);
    //setCaret();
    if (synchronized) {
        sendPatch(editor.innerHTML);
    }
}
function setHangulSelection(event){
    setCaret();
    if(isHangul(inputText)){//console.log("한글")
        endCaret = endCaret +1;
        console.log("startCaret",startCaret);
        console.log("endCaret",endCaret)
        moveCursor(editor,startCaret,endCaret)
    }
    //moveCursor(editor,startCaret,endCaret)
    inputText = ""
}
function setCaret(){
    try{
    startCaret = getCaretPositionStart(editor);
    endCaret = getCaretPositionEnd(editor);
    }
    catch(e){
        //console.log("set"e);
    }
}


function getDocs() {
    $.ajax({
        type: "GET",
        url: baseUrl + "/docs/" + docsId,
        cache: false,
        success: function (response) {
            response_body = JSON.parse(response);
            let response_doc = response_body["docs"];
            let content = response_doc["content"];
            clientVersion = response_doc["version"];
            serverVersion = response_doc["version"];
            let response_patches = response_body["patchInfos"];
            if (response_patches.length >= 1) {
                console.log(response_patches);
                //console.log(response_doc);
                content = initDocs(response_patches,content);
            } 
            document.getElementById("mokkiTextPreview").innerHTML = content;
            prev = content;
            document.getElementById('text2b').value = content;
            synchronized = true;
        }
    });
}

function initDocs(response_patches,content,isConflict) {
    let result = content;
    let ms_start = (new Date).getTime();
    console.log("stcaret",startCaret,"endcaret",endCaret)
    response_patches.forEach(function (item, index, array) {
        let itemSessionId = item["clientSessionId"];
        if(isConflict){
            itemSessionId = "";
        }

        if (clientVersion < item["patchVersion"] && clientSessionId != itemSessionId) {
            let patches = dmp.patch_fromText(item["patchText"]);
            //console.log(patches)
            if(!isConflict){
                calcCursor(item.startIdx,item.endIdx,patches[0].diffs)
            }
            let results = dmp.patch_apply(patches, result);
            result = results[0];
            clientVersion = item["patchVersion"];
            serverVersion = item["patchVersion"];
        }
    });
    console.log("stcaret",startCaret,"endcaret",endCaret)
    let ms_end = (new Date).getTime();
    console.log("걸린시간",(ms_end - ms_start) /1000)
    return result;
}
function calcCursor(startIdx,endIdx,diff){
    
    if(startIdx<=startCaret){
        tempDiff=setDiff(diff);
        //console.log(tempDiff)
        moveIdx = tempDiff[1].length-tempDiff[2].length
        startCaret +=moveIdx;
        endCaret += moveIdx;
    }
}

function sendPatch(current) {
    let diff = dmp.diff_main(prev, current, true);
    dmp.diff_cleanupSemantic(diff);
    if ((diff.length > 1) || (diff.length == 1 && diff[0][0] != 0)) { // 1 이상이어야 변경 한 것이 있음
        let res = setDiff(diff);
        if (!(Hangul.disassemble(res[2]).length == Hangul.disassemble(res[1]).length + 1) || (keycode == "Backspace" || keycode == "Delete")) {
            synchronized = false;
            let patch_list = dmp.patch_make(prev, current, diff);
            let patch_text = dmp.patch_toText(patch_list);
            sendContentPost(patch_text);
            let text1 = document.getElementById('text2b').value;
            let results = dmp.patch_apply(patch_list, text1);
            document.getElementById('text2b').value = results[0];
            prev = editor.innerHTML;
        }
        keycode = "";
    }
}

function sendContentPost(patchText) {
    let reqBody = {
        "socketSessionId": clientSessionId,
        "docsId": docsId,
        "clientVersion": clientVersion,
        "patchText": patchText,
        "startIdx" : startCaret,
        "endIdx" : endCaret
    }
    //console.log("보낼때 startidx",startCaret,"보낼떄 endidx",endCaret)
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
                    //isCycle = false;
                    return [idx, insertString, deleteString]
                    // res.push([idx, insertString, deleteString]);
                    // insertString = "";
                    // deleteString = "";
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
    // if (isCycle) {
    //     res.push([idx, insertString, deleteString])
        
    // }
    // return res;
    return [idx, insertString, deleteString]
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
    let response_patches = response_body.patchInfos;
    serverVersion = response_body.serverVersion;
    if (receiveSessionId == clientSessionId) {
        let current = editor.innerHTML;
        if(response_patches.length > 1){ // 꼬여서 다시 부를 떄
            
            let snapshotText = response_body.snapshotText;
            clientVersion = 0;
            setCaret();
            let result = initDocs(response_patches,snapshotText,true);
            
            if(current != result){
                console.log(current)
                console.log(result)
                console.log("꼬여서 다시 부름")
                editor.innerHTML = result;
                moveCursor(editor,startCaret,endCaret)
             }   
            setCaret();                
                         
        }
        else{
            setCaret();
            let result = initDocs(response_patches,current);
            //setCaret();
            if(current != result){
               editor.innerHTML = result;
               moveCursor(editor,startCaret,endCaret)
            }  
            setCaret(); 
        }
        synchronized = true;
        clientVersion = serverVersion;
        sendPatch(current);
    } 
    if(receiveSessionId != clientSessionId && synchronized){
        //console.log("?")
        let text1 = editor.innerHTML;
        setCaret();
        let result = initDocs(response_patches, text1);
        editor.innerHTML = result;        
        moveCursor(editor,startCaret,endCaret)
        setCaret();
        prev = result;
        clientVersion = serverVersion;
        document.getElementById('text2b').value = result;
    }
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


function moveCursor(el,start, end){
    text_node_list = [];
    getTextNode(el);
    let text_length = 0;
    let start_cursor = 0;
    let start_element;
    let end_cursor = 0;
    let end_element;
    console.log("start,end",start,end)
    console.log("text_mode_list",text_node_list)
        
    for(index in text_node_list){
        console.log(index)
        if(start <= text_length + text_node_list[index].length && start_element == null){
            start_cursor = start - text_length;
            start_element = text_node_list[index];
        }
        if(end <= text_length + text_node_list[index].length && end_element == null){
            end_cursor = end - text_length;
            end_element = text_node_list[index];
            break;
        }
    	text_length += text_node_list[index].length;
    }
    let range = document.createRange();
    try{
        console.log(start_element,start_cursor)
        console.log(end_element,end_cursor)
        console.log("st",startCaret)
        console.log("end",endCaret)
        range.setStart(start_element, start_cursor);
        range.setEnd(end_element, end_cursor);
    }
    catch(e){
        console.log(e);     
    }
    
    let sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    
}

function getTextNode(element){
    let child_node_list = element.childNodes;
    for(e1 in child_node_list){
        if(child_node_list[e1].nodeType == Node.TEXT_NODE){
            text_node_list.push(child_node_list[e1]);
        } else{
            getTextNode(child_node_list[e1]);
        }
    }
}
function getCaretPositionEnd(element) {
    var caretOffset = 0;
    if (w3) {
        var range = window.getSelection().getRangeAt(0);
        var preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        caretOffset = preCaretRange.toString().length;
    } else if (ie) {
        var textRange = document.selection.createRange();
        var preCaretTextRange = document.body.createTextRange();
        preCaretTextRange.moveToElementText(element);
        preCaretTextRange.setEndPoint("EndToEnd", textRange);
        caretOffset = preCaretTextRange.text.length;
    }
    return caretOffset;
}

function getCaretPositionStart(element) {
    var caretOffset = 0;
    if (w3) {
        var range = window.getSelection().getRangeAt(0);
        var preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        caretOffset = preCaretRange.toString().length;
    } else if (ie) {
        var textRange = document.selection.createRange();
        var preCaretTextRange = document.body.createTextRange();
        preCaretTextRange.moveToElementText(element);
        preCaretTextRange.setStartPoint("StartToStart", textRange);
        caretOffset = preCaretTextRange.text.length;
    }
    return caretOffset;
}
