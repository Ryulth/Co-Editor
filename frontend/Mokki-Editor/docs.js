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
getDocs();

window.onload = function () {
    connect();
    editor = document.getElementById("mokkiTextPreview");
    let bar = document.getElementById("mokkiButtonBar");
    editor.addEventListener("keydown", function (event) {
        keycode = event.code;
        if(synchronized){
            prev = editor.innerHTML;
        }
        myCaret = getCaretPosition(editor);
    });
    bar.addEventListener("click",function(){ 
        if(synchronized){
            prev = editor.innerHTML;
        }
    });
    editor.addEventListener("DOMSubtreeModified", function (event) {
    }, false);
    editor.addEventListener("input", function (event) {
        let inputText = event.data;
        //console.log(inputText)
        console.log(myCaret);
        if(isHangul(inputText)){//console.log("한글")
            
            selectElementContents(editor,myCaret);
        }
        if (synchronized) {
            sendPatch(editor.innerHTML);
        }
    });
}
function getCaretPosition(element) {
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

function selectElementContents(el,idx) {
    let range = document.createRange();
    let startNode = el.childNodes[0];
    let endNode = el.childNodes[0]
    range.setStart(startNode, idx);
    range.setEnd(endNode, idx+1);
    let sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
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
                //console.log(response_patches);
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
    response_patches.forEach(function (item, index, array) {
        let itemSessionId = item["clientSessionId"];
        if(isConflict){
            itemSessionId = "";
        }
        if (clientVersion < item["patchVersion"] && clientSessionId != itemSessionId) {
            
            let patches = dmp.patch_fromText(item["patchText"]);
            let results = dmp.patch_apply(patches, result);
            result = results[0];
            clientVersion = item["patchVersion"];
            serverVersion = item["patchVersion"];
        }
    });
    let ms_end = (new Date).getTime();
    //console.log("걸린시간",(ms_end - ms_start) /1000)
    return result;
}

function sendPatch(current) {
    let diff = dmp.diff_main(prev, current, true);
    dmp.diff_cleanupSemantic(diff);
    
    if ((diff.length > 1) || (diff.length == 1 && diff[0][0] != 0)) { // 1 이상이어야 변경 한 것이 있음
        let res = setDiff(diff);
        if (!(Hangul.disassemble(res[0][2]).length == Hangul.disassemble(res[0][1]).length + 1) || (keycode == "Backspace" || keycode == "Delete")) {
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
        "patchText": patchText
    }
    //console.log("보낸거",reqBody)
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
            //console.log("응답", response_body)
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
        if(response_patches.length > 1){
            let snapshotText = response_body.snapshotText;
            clientVersion = 0;
            let result = initDocs(response_patches,snapshotText,true);
            if(current != result){
                editor.innerHTML = result;
             }   
        }
        else{
            
            let result = initDocs(response_patches,current);
            if(current != result){
               editor.innerHTML = result;
            }   
        }
        synchronized = true;
        clientVersion = serverVersion;
        sendPatch(current);
    } else if(synchronized){
        let text1 = editor.innerHTML;
        let result = initDocs(response_patches, text1);
        //calcString();
        editor.innerHTML = result;
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

function sleep(delay) {
    var start = new Date().getTime();
    while (new Date().getTime() < start + delay);
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
// function getCaretPosition1(editableDiv) {
//     var caretPos = 0,
//       sel, range;
//     if (window.getSelection) {
//       sel = window.getSelection();
//       if (sel.rangeCount) {
//         range = sel.getRangeAt(0);
//         if (range.commonAncestorContainer.parentNode == editableDiv) {
//           caretPos = range.endOffset;
//         }
//       }
//     } else if (document.selection && document.selection.createRange) {
//       range = document.selection.createRange();
//       if (range.parentElement() == editableDiv) {
//         var tempEl = document.createElement("span");
//         editableDiv.insertBefore(tempEl, editableDiv.firstChild);
//         var tempRange = range.duplicate();
//         tempRange.moveToElementText(tempEl);
//         tempRange.setEndPoint("EndToEnd", range);
//         caretPos = tempRange.text.length;
//       }
//     }

//     return caretPos;
//   }

//   function getCaretCharacterOffsetWithin(element) {
//     var caretOffset = 0;
//     var doc = element.ownerDocument || element.document;
//     var win = doc.defaultView || doc.parentWindow;
//     var sel;
//     if (typeof win.getSelection != "undefined") {
//       sel = win.getSelection();
//       if (sel.rangeCount > 0) {
//         var range = win.getSelection().getRangeAt(0);
//         var preCaretRange = range.cloneRange();
//         preCaretRange.selectNodeContents(element);
//         preCaretRange.setEnd(range.endContainer, range.endOffset);
//         caretOffset = preCaretRange.toString().length;
//       }
//     } else if ((sel = doc.selection) && sel.type != "Control") {
//       var textRange = sel.createRange();
//       var preCaretTextRange = doc.body.createTextRange();
//       preCaretTextRange.moveToElementText(element);
//       preCaretTextRange.setEndPoint("EndToEnd", textRange);
//       caretOffset = preCaretTextRange.text.length;
//     }
//     return caretOffset;
//   }
  
//   function getCaretPosition() {
//     if (window.getSelection && window.getSelection().getRangeAt) {
//       var range = window.getSelection().getRangeAt(0);
//       var selectedObj = window.getSelection();
//       var rangeCount = 0;
//       var childNodes = selectedObj.anchorNode.parentNode.childNodes;
//       let i;
//       for (i = 0; i < childNodes.length; i++) {
//         if (childNodes[i] == selectedObj.anchorNode) {
//           break;
//         }
//         if (childNodes[i].outerHTML)
//           rangeCount += childNodes[i].outerHTML.length;
//         else if (childNodes[i].nodeType == 3) {
//           rangeCount += childNodes[i].textContent.length;
//         }
//       }
//       return [childNodes[i] ,range.startOffset];
//     }
//     return -1;
//   }
  