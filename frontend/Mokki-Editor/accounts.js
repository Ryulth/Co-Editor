/*
    @baseurl = 서버주소
    @type = docs or spreedshit
    @id = 문서의 id
*/
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
        async: true, // false 일 경우 동기 요청으로 변경
        type: "GET",
        contentType: "application/json",
        url: sendUrl,
        success: function (response) {
            console.log(JSON.parse(response))
        }
    });
}