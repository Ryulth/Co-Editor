let dmp = null;
let stompClient = null;
let clientSessionId = null;
let docsId = location.href.substr(location.href.lastIndexOf('?') + 1);
let baseUrl ="http://10.77.34.204:8080/docs";
$(document).ready(function() {
dmp = new diff_match_patch();
getDocs();
connect();
});
$(function () {
    let input = $ ('#docs-text');
    input.on("beforeinput", function(){
          $(this).data('val', $(this).val());
    });
    input.on("input", function(){
        let prev = $(this).data('val');
        let current = $(this).val();
        let diff = dmp.diff_main(prev, current);
        dmp.diff_cleanupSemantic(diff);
        res = setDiffString(diff);
        sendContentPost(res,prev.length);
        $(this).height(1).height( $(this).prop('scrollHeight')+12 );
        updateDocs();
    });

    $("form").on('submit', function (e) {
        e.preventDefault();
    });
    $( "#connect" ).click(function() { connect(); });
    $( "#disconnect" ).click(function() { disconnect(); });

});
function setDiffString(diff){
    let idx = 0;
    let insertString = "";
    let deleteString = "";
    let flag = true;
    diff.forEach(function(element) {
      console.log(element);
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

function getDocs(){
    $.ajax({
      type: "GET",
      url: baseUrl+"/"+docsId,
      cache: false,
      success: function(response){
         let trHTML = '';
         let content = response["content"]
         let input = $( "#docs-text" );
         input.val( content );
       }
    });
}
function updateDocs(){
    $("#save-text").text("저장중")
     let reqBody = {}
     reqBody["id"] = docsId;
     reqBody["title"] = "temp";
     reqBody["content"] = $("#docs-text").val();
    $.ajax({
      async: true, // false 일 경우 동기 요청으로 변경
      type: "PUT",
      contentType: "application/json",
      url: baseUrl,
      data: JSON.stringify(reqBody),
      dataType: 'json',
      success: function(response){
         console.log("save "+response);
       }
    });
    $("#save-text").text("저장완료")
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

function connect() {
    let socket = new SockJS('/docs-websocket');
    stompClient = Stomp.over(socket);
    stompClient.connect({}, function (frame) {
        setConnected(true);
        console.log("Connected" + frame);
        clientSessionId = /\/([^\/]+)\/websocket/.exec(socket._transport.url)[1];
        stompClient.subscribe('/topic/docs'+"/"+docsId, function (content) {
            let receiveSessionId = JSON.parse(content.body).sessionId;
            if(receiveSessionId!=clientSessionId){
            showContent(JSON.parse(content.body));
            }
        });
    });
}

function disconnect() {
    if (stompClient !== null) {
        stompClient.disconnect();
    }
    setConnected(false);
    console.log("Disconnected");
}
function sendContentPost(res,originalLength){
    //console.log(cursorPos +" , " +diff+" , "+diff2 )
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
                    "originalLength": originalLength
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
function showContent(message) {
    let input = $( "#docs-text" );
    let cursorPos= input.prop('selectionStart');
    let insertLength = message.insertLength;
    let insertPos = message.insertPos;
    let deleteLength = message.deleteLength;
    let deletePos = message.deletePos;
    let content = message.docs.content;
    //let result = input.val();
    //result = del(result,deletePos,deleteLength);
    //result = insert(result,insertPos,insertString);
    input.val( content );
    console.log(insertPos)
    console.log(cursorPos)
   // if(escape(insertString.charAt(0)).length == 6){
     //    insertLength = insertLength/2
    //}
    if(insertPos > cursorPos && deleteLength == 0){
    input.prop('selectionStart', cursorPos-deleteLength);
    input.prop('selectionEnd', cursorPos-deleteLength);
    }
    else if(deletePos > cursorPos ){
    input.prop('selectionStart', cursorPos+insertLength);
    input.prop('selectionEnd', cursorPos+insertLength);
    }
    else{
    input.prop('selectionStart', cursorPos+insertLength-deleteLength);
    input.prop('selectionEnd', cursorPos+insertLength-deleteLength);
    }
    $("textarea.autosize").height(1).height( $("textarea.autosize").prop('scrollHeight')+12 );
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







