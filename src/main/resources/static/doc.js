let stompClient = null;
let clientSessionId = null;
let docId = location.href.substr(location.href.lastIndexOf('?') + 1);
let baseUrl ="http://localhost:8080/docs";
$(document).ready(function() {
getDocs();
connect();
});
function getDocs(){
    $.ajax({
      type: "GET",
      url: baseUrl+"/"+docId,
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
     reqBody["id"] = docId;
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
        stompClient.subscribe('/topic/docs'+"/"+docId, function (content) {
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
function sendContent(diff,diff2,cursorPos) {
    let input = $( "#docs-text" );
//    let cursorPos= input.prop('selectionStart');
    //if(escape(diff.charAt(0)).length == 6){
     //   cursorPos ++;
   //}
    let times = parseInt(diff.length/65500)+1;
    let i;
    for(i = 0; i<times;i++){
        let shift = i * 65500
        console.log(cursorPos +" , " +diff+" , "+diff2 )
        stompClient.send("/app/docs"+"/"+docId, {}, JSON.stringify({'insertString':diff,
                                                                       'insertPos' : cursorPos-shift,
                                                                       'deleteLength' : diff2.length,
                                                                       'deletePos' : cursorPos+shift
                                                                        }));
    }
}

function showContent(message) {
    let input = $( "#docs-text" );
    let insertString = message.insertString;
    let insertPos = message.insertPos;
    let deleteLength = message.deleteLength;
    let deletePos = message.deletePos;
    let result = input.val();
    result = del(result,deletePos,deleteLength);
    result = insert(result,insertPos,insertString);

    input.val( result );
    $("textarea.autosize").height(1).height( $("textarea.autosize").prop('scrollHeight')+12 );
}
function insert(str, index, value) {
    return str.substr(0, index) + value + str.substr(index);
}
function del(str,index,length){
    return str.slice(0, index) + str.slice(index+length);
}
$(function () {
    let input = $ ('#docs-text');
    input.on('keydown', function(){
        $(this).data('val', $(this).val());
    });
    input.on("input", function(){
        let prev = $(this).data('val');
        let current = $(this).val();
        let temp_diff = text_diff(prev,current);
        let cursorPos = temp_diff[0];
        let diff = temp_diff[1];
        let diff2 = text_diff(current,prev)[1];
        sendContent(diff,diff2,cursorPos);
        $(this).height(1).height( $(this).prop('scrollHeight')+12 );
        updateDocs();
    });

    $("form").on('submit', function (e) {
        e.preventDefault();
    });
    $( "#connect" ).click(function() { connect(); });
    $( "#disconnect" ).click(function() { disconnect(); });

    $(document).on('click', 'a', function () {
        window.location.href = 'docs.html?'+this.id;
    });
});
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