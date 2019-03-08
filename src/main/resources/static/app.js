let stompClient = null;
let clientSessionId = null;
let baseUrl ="http://localhost:8080/docs";
$(document).ready(function() {
getDocs();
$("textarea.autosize").height(1).height( $("textarea.autosize").prop('scrollHeight')+12 );
});
function getDocs(){
    $.ajax({
      type: "GET",
      url: baseUrl,
      cache: false,
      success: function(response){
         let trHTML = '';
         let data = response["docs"]
         for(let i=0;i<data.length;i++) {
              let href= baseUrl +"/" +data[i]['id']
              $("#table-docs").append("<tr><td  ><a href=javascript:void(0) id="+data[i]['id']+">" + data[i]['title'] + "</a></td></tr>");
            }
      }
    });

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
        stompClient.subscribe('/topic/docs', function (greeting) {
            let receiveSessionId = JSON.parse(greeting.body).sessionId;
            if(receiveSessionId!=clientSessionId){
            showContent(JSON.parse(greeting.body).text);
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

function sendName() {
    stompClient.send("/app/docs", {}, JSON.stringify({'name': $("#name").val()}));
}
function sendContent() {
    stompClient.send("/app/docs", {}, JSON.stringify({'text': $("#docs-text").val()}));
}

function showContent(message) {
    var input = $( "#docs-text" );
    input.val( message );
    $("textarea.autosize").height(1).height( $("textarea.autosize").prop('scrollHeight')+12 );

}

$(function () {
    $("textarea.autosize").on('input', function () {

        $(this).height(1).height( $(this).prop('scrollHeight')+12 );
        sendContent();

    });
    $("form").on('submit', function (e) {
        e.preventDefault();
    });

    $( "#connect" ).click(function() { connect(); });
    $( "#disconnect" ).click(function() { disconnect(); });
    $( "#send" ).click(function() { sendName(); });

    $(document).on('click', 'a', function () {
        window.location.href = 'docs.html?'+this.id;
    });
});

