const ie = (typeof document.selection != "undefined" && document.selection.type != "Control") && true;
const w3 = (typeof window.getSelection != "undefined") && true;
const baseUrl = "http://10.77.34.204:8080";
const docsId = 3;//location.href.substr(location.href.lastIndexOf('?') + 1);
const dmp = new diff_match_patch();
const inputType = /Trident/.test( navigator.userAgent ) ? 'textinput' : 'input';
let editor;
let synchronized = true; 
let clientVersion;
let stompClient;
let clientSessionId;
let prevText;

window.onload = function () {
    getDocs();
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
                content = patchDocs(response_patches,content,clientVersion);
            } 
            document.getElementById("mokkiTextPreview").innerHTML = content;
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
    let serverVersion = response_body.serverVersion;
    if (receiveSessionId == clientSessionId) {
        let current = editor.innerHTML;
        if(response_patcheInfos.length > 1){ // 꼬여서 다시 부를 떄
            let snapshotText = response_body.snapshotText;
            //clientVersion = 0;
            setCaret();
            let result = initDocs(response_patcheInfos,snapshotText,0);
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
            let result = patchDocs(response_patcheInfos,current,clientVersion);
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
        let result = patchDocs(response_patcheInfos, text1);
        editor.innerHTML = result;        
        moveCursor(editor,startCaret,endCaret)
        setCaret();
        prev = result;
        clientVersion = serverVersion;
        document.getElementById('text2b').value = result;
    }
}
function patchDocs(response_patches,content,startClientVersion) {
    let result = content;
    let ms_start = (new Date).getTime();
    response_patches.forEach(function (item, index, array) {
        let itemSessionId = item["clientSessionId"];
        if(isConflict){
            itemSessionId = "";
        }

        if (startClientVersion < item["patchVersion"] && clientSessionId != itemSessionId) {
            let patches = dmp.patch_fromText(item["patchText"]);
            //console.log(patches)
            if(!isConflict){
                calcCursor(item.startIdx,item.endIdx,patches[0].diffs)
            }
            let results = dmp.patch_apply(patches, result);
            result = results[0];
            startClientVersion += 1;
        }
        if (index === (array.length -1)) {
            clientVersion = item["patchVersion"];
        }
    });
    let ms_end = (new Date).getTime();
    console.log("걸린시간",(ms_end - ms_start) /1000)
    return result;
}