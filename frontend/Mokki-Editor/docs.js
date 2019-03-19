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
let dmp = new diff_match_patch();
getDocs();

window.onload = function () {
    connect();
    
    editor = document.getElementById("mokkiTextPreview");
    let bar = document.getElementById("mokkiButtonBar");
    editor.addEventListener("keydown", function (event) {
        keycode = event.code;
        prev = editor.innerHTML;
    });
    bar.addEventListener("click",function(){ 
        prev = editor.innerHTML;
    });
    editor.addEventListener("DOMSubtreeModified", function (event) {
    }, false);
    editor.addEventListener("input", function (event) {
        if (synchronized) {
            sendPatch();
        }
        keydata = event.data;
        if (keycode == "Backspace") {
            keydata = "";
        }
    });
}

function getDocs() {
    $.ajax({
        type: "GET",
        url: baseUrl + "/docs/" + docsId,
        cache: false,
        success: function (response) {
            response = JSON.parse(response);
            let response_doc = response["docs"];
            let content = response_doc["content"];
            clientVersion = response_doc["version"];
            serverVersion = response_doc["version"];
            let response_patches = response["patchInfos"];
            if (response_patches.length >= 1) {
                console.log(response_patches);
                content = initDocs(response_patches);
            } 
            document.getElementById("mokkiTextPreview").innerHTML = content;
            prev = content;
            document.getElementById('text2b').value = content;
            synchronized = true;
        }
    });
}

function initDocs(response_patches,content) {
    let result = content;
    response_patches.forEach(function (item, index, array) {
        let patches = dmp.patch_fromText(item["patchText"]);
        let results = dmp.patch_apply(patches, result);
        result = results[0];
    });
    return result;
}

function sendPatch() {
    console.log("에디터", editor)
    let text1 = document.getElementById('text2b').value;
    let current = editor.innerHTML;
    console.log("prev", prev)
    console.log("current", current)
    let diff = dmp.diff_main(prev, current, true);
    dmp.diff_cleanupSemantic(diff);

    if ((diff.length > 1) || (diff.length == 1 && diff[0][0] != 0)) { // 1 이상이어야 변경 한 것이 있음
        let res = setDiff(diff);
        if (!(Hangul.disassemble(res[0][2]).length == Hangul.disassemble(res[0][1]).length + 1) || (keycode == "Backspace")) {
            synchronized = false;
            let patch_list = dmp.patch_make(prev, current, diff);
            let patch_text = dmp.patch_toText(patch_list);
            sendContentPost(patch_text);
            let results = dmp.patch_apply(patch_list, text1);
            document.getElementById('text2b').value = results[0];
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
    $.ajax({
        async: true, // false 일 경우 동기 요청으로 변경
        type: "POST",
        contentType: "application/json",
        url: baseUrl + "/docs/" + docsId,
        data: JSON.stringify(reqBody),
        dataType: 'json',
        success: function (response) {}
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
        console.log("Connected" + frame);
        clientSessionId = /\/([^\/]+)\/websocket/.exec(socket._transport.url)[1];
        stompClient.subscribe('/topic/docs' + "/" + docsId, function (content) {
            response_body = JSON.parse(content.body);
            console.log("응답", response_body)
            receiveContent(response_body) //
        });
    });
}

function calcString(message) {
    let input = document.getElementById("mokkiTextEmbed");
    let cursorStartPos = input.selectionStart;
    let cursorEndPos = input.selectionEnd;
    prev = result;
    editor.innerHTML = result;
    input.focus();
    input.setSelectionRange(cursorStartPos, cursorEndPos);
}

function receiveContent(response_body) {
    let response_patchText = response_body.patchText;
    let receiveSessionId = response_body.socketSessionId;
    let response_patches = response_body.patchInfos;
    serverVersion = response_body.serverVersion;
    if (receiveSessionId == clientSessionId) {
        synchronized = true;
        clientVersion = serverVersion;
    } else {
        let text1 = editor.innerHTML;
//        initDocs(response_patches, text1)
//        let patches = dmp.patch_fromText(response_patchText);
//        let results = dmp.patch_apply(patches, text1);
        let result = initDocs(response_patches, text1);
        editor.innerHTML = result;
        prev = result;
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
