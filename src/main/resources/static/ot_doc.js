const baseUrl ="http://10.77.34.205:8080/docs";
let dmp = null;
let stompClient = null;
let clientSessionId = null;
let docsId = location.href.substr(location.href.lastIndexOf('?') + 1);
let prev;
let version;
let synchronized;
let response_list = [];
let cache_res;
$(document).ready(function() {
    dmp = new diff_match_patch();
    getDocs();
    connect();
});

function getDocs(){
    $.ajax({
      type: "GET",
      url: baseUrl+"/"+docsId,
      cache: false,
      success: function(response){
         let trHTML = '';
         let content = response["content"];
         version = response["version"];
         let input = $( "#docs-text" );
         input.val( content );
         prev = content;
         synchronized = true;
       }
    });
}

function connect() {
    let socket = new SockJS('/docs-websocket');
    stompClient = Stomp.over(socket);
    stompClient.connect({}, function (frame) {
        setConnected(true);
        console.log("Connected" + frame);
        clientSessionId = /\/([^\/]+)\/websocket/.exec(socket._transport.url)[1];
        stompClient.subscribe('/topic/docs'+"/"+docsId, function (content) {
            response_body = JSON.parse(content.body);
            console.log(response_body);
            response_content = response_body.contents;
            let receiveSessionId = response_body.sessionId;
            console.log(version)

            let current = $( "#docs-text" ).val();
            let diff = dmp.diff_main(prev, current);
            dmp.diff_cleanupSemantic(diff);
            res = setDiffString(diff);

            response = response_content[version];

            if(receiveSessionId == clientSessionId){
                while(response != null){
                    if(response.sessionId != clientSessionId){
                        if (response.insertPos > cache_res[0] && cache_res[1] != ""){
                            console.log("cache_resaaaaaaaaaa")
                            response.insertPos += cache_res[1].length;
                        }
                        if (response.deletePos > cache_res[0] && cache_res[1] != ""){
                            console.log("cache_resbbbbb")
                            response.deletePos += cache_res[1].length;
                        }
                        if (response.insertPos > cache_res[0] && cache_res[2] != ""){
                            console.log("cache_resccccc")
                            response.insertPos -= cache_res[2].length;
                        }
                        if (response.deletePos > cache_res[0] && cache_res[2] != ""){
                            console.log("cache_resdddddd")
                            response.deletePos -= cache_res[2].length;
                        }
                        response_list.push(response);
                    }
                    version++;
                    response = response_content[version];
                }
                showContentList(res);
                synchronized = true;
                sendBufferContent(res, current);
                prev = $( "#docs-text" ).val();
            } else if(synchronized){
                while(response != null){
                    if(response.sessionId != clientSessionId){
                        response_list.push(response);
                    }
                    version++;
                    response = response_content[version];
                }
                console.log(res);
                showContentList(res);
                prev = $( "#docs-text" ).val();
            }
        });
    });
}

function showContentList(res){
    console.log(response_list)
    for(index in response_list){
        let response = response_list[index]
        if (response.insertPos > res[0] && res[1] != ""){
            console.log("aaaaaaaaaa")
            response.insertPos += res[1].length;
        }
        if (response.deletePos > res[0] && res[1] != ""){
            console.log("bbbbb")
            response.deletePos += res[1].length;
        }
        if (response.insertPos > res[0] && res[2] != ""){
            console.log("ccccc")
            response.insertPos -= res[2].length;
        }
        if (response.deletePos > res[0] && res[2] != ""){
            console.log("dddddd")
            response.deletePos -= res[2].length;
        }
        showContent(response);
    }
    response_list = [];
}
function showContent(message) {
    console.log(message);
    let input = $( "#docs-text" );
    let cursorStartPos= input.prop('selectionStart');
    let cursorEndPos= input.prop('selectionEnd');
    let insertString = message.insertString;
    let insertPos = message.insertPos;
    let insertLength = insertString.length;
    let deleteLength = message.deleteLength;
    let deletePos = message.deletePos;
    let result = input.val();
    result = del(result,deletePos,deleteLength);
    result = insert(result,insertPos,insertString);
    input.val( result );
//    prev = result;

    console.log("-------------------------------");
    console.log(insertPos+", "+deletePos);
    console.log(cursorStartPos+", "+cursorEndPos);
    if(insertPos < cursorStartPos && insertLength > 0){
        cursorStartPos = cursorStartPos + insertLength
        cursorEndPos = cursorEndPos + insertLength;
    } else if(insertPos < cursorEndPos && insertLength > 0){
        cursorStartPos = cursorStartPos;
        cursorEndPos = cursorEndPos + insertLength;
    }

    if(deletePos + deleteLength < cursorStartPos && deleteLength > 0){
        cursorStartPos = cursorStartPos - deleteLength;
        cursorEndPos = cursorEndPos - deleteLength;
    } else if(deletePos < cursorStartPos && deleteLength > 0){
        if(deletePos + deleteLength < cursorEndPos){
            cursorStartPos = deletePos;
            cursorEndPos = cursorEndPos - deleteLength;
        } else{
            cursorStartPos = deletePos;
            cursorEndPos = deletePos;
        }
    } else if(deletePos < cursorEndPos && deleteLength > 0){
        cursorStartPos = cursorStartPos
        cursorEndPos = cursorEndPos - deleteLength;
    }

    input.prop('selectionStart', cursorStartPos);
    input.prop('selectionEnd', cursorEndPos);

    console.log(input.prop('selectionStart')+", "+input.prop('selectionEnd'));
    console.log("-------------------------------");
    $("textarea.autosize").height(1).height( $("textarea.autosize").prop('scrollHeight')+12 );
}

function setConnected(connected) {
    $("#connect").prop("disabled", connected);
    $("#disconnect").prop("disabled", !connected);
    if (connected) {
        $("#conversation").show();
    }
    else {
        $("#conversation").hide();
    }
    $("#greetings").html("");
}

function disconnect() {
    if (stompClient !== null) {
        stompClient.disconnect();
    }
    setConnected(false);
    console.log("Disconnected");
}

$(function () {
    let input = $ ('#docs-text');
    let keycode;

    document.getElementById("docs-text").addEventListener("keydown", function(event){
        keycode = event.code;

    });

    document.getElementById("docs-text").addEventListener("keydown", function(event){
        keycode = event.code;
    });

    input.on("input", sendBuffer);


    $("form").on('submit', function (e) {
        e.preventDefault();
    });
    $( "#connect" ).click(function() { connect(); });
    $( "#disconnect" ).click(function() { disconnect(); });

});

function sendBuffer(){
    console.log("sendBuffer")
    let input = $( "#docs-text" );
    if(synchronized){
        let current = input.val();
        let diff = dmp.diff_main(prev, current);
        dmp.diff_cleanupSemantic(diff);
        console.log(diff)
        res = setDiffString(diff);
        sendBufferContent(res, current)
//        if(!(res[1] == "" && res[2] == ""))
//        {
//            if((!(Hangul.disassemble(res[2]).length == 3 && Hangul.disassemble(res[1]).length == 2) || (keycode == "Backspace"))){
//                synchronized = false;
//                console.log(res)
//                sendContentPost(res,prev.length);
//                input.height(1).height( input.prop('scrollHeight')+12 );
//                prev = current;
//            }
//        }
        keycode="";
    }else{
        console.log("buffer~~~~");
        let current = input.val();
        let diff = dmp.diff_main(prev, current);
        dmp.diff_cleanupSemantic(diff);
        console.log(diff)
    }
}

function sendBufferContent(res, current){
    let input = $( "#docs-text" );
    if(!(res[1] == "" && res[2] == "")){
        if((!(Hangul.disassemble(res[2]).length == 3 && Hangul.disassemble(res[1]).length == 2) || (keycode == "Backspace"))){
            synchronized = false;
            cache_res = res;
            console.log(res)
            sendContentPost(res,prev.length);
            input.height(1).height( input.prop('scrollHeight')+12 );
        }
    }
    prev = current;
}

function sendContentPost(res,originalLength){
    let cursorPos = res[0];
    let insertString = res[1];
    let deleteString = res[2];
    let reqBody = {
                "commands": {
                    "delete": {
                        "index": cursorPos,
                        "size": deleteString.length
                        },
                    "insert": {
                        "index": cursorPos,
                        "text": insertString
                        },
                    "originalLength": originalLength,
                    "version" : version
                    },
                    "sessionId" : clientSessionId,
                    "docsId" : docsId
                }
    $.ajax({
      async: true, // false 일 경우 동기 요청으로 변경
      type: "POST",
      contentType: "application/json",
      url: baseUrl +"/"+docsId,
      data: JSON.stringify(reqBody),
      dataType: 'json',
      success: function(response){
       }
    });
}

function setDiffString(diff){
    let idx = 0;
    let insertString = "";
    let deleteString = "";
    let flag = true;
    diff.forEach(function(element) {
      switch (element[0]){
        case 0 : // retain
            if(flag){
                idx += element[1].length;
            }
            break;
        case -1 : // delete
            flag = false;
            deleteString = element[1];
            break;
        case 1 : // insert
            flag = false;
            insertString = element[1];
            break;
      }
    });
    return [idx,insertString,deleteString]
}

function insert(str, index, value) {
    return str.substr(0, index) + value + str.substr(index);
}
function del(str,index,length){
    return str.slice(0, index) + str.slice(index+length);
}

function text_diff(first, second) { // SECOND 가 커야함
    let start = 0;
    while (start < first.length && first[start] == second[start]) {
        ++start;
    }
    let end = 0;
    while (first.length - end > start && first[first.length - end - 1] == second[second.length - end - 1]) {
        ++end;
    }
    end = second.length - end;
    return [start,second.substr(start, end - start)];
}