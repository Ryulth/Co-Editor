(function(){
    const baseUrl = "http://10.77.34.204:8080";
    const coeditId = 1;//location.href.substr(location.href.lastIndexOf('?') + 1);
    const dmp = new diff_match_patch();
    const inputType = /Trident/.test( navigator.userAgent ) ? 'textinput' : 'input';
    const editorType = "docs";
    let editor;
    let editorScroll;
    let synchronized = true; 
    let clientVersion;
    let stompClient;
    let clientSessionId;
    let prevText;
    let pprevText;
    let startCaret =0;
    let endCaret =0;
    let keycode = "";
    let isPaste = false;
    let cursorInterval;
    let intervalCount = 0;
    let caretContainer;
    let setEditor = function (editorEl,editorBarEl){
        CaretVis.init();
        let editorBar = editorBarEl;
        editorScroll = document.getElementsByClassName("te-editor")[1];
        editor = editorEl;
        editor.setAttribute("autocorrect","off");
        editor.setAttribute("autocapitalize","off");
        editor.setAttribute("autocomplete","off");
        editor.setAttribute("spellcheck",false);
        caretContainer = document.getElementsByClassName("caret-container")[0];
        getDocs();
        if (editor.addEventListener) {
            editor.addEventListener("keydown", keydownAction);
            editorBar.addEventListener("click",clickAction)
            editor.addEventListener("mouseup", mouseupAction);
            editor.addEventListener(inputType, inputAction);
            editor.addEventListener("keyup", keyupAction);
            editor.addEventListener("paste", function(e){
                isPaste = true;
            });
            editorScroll.addEventListener("scroll", function(){
                caretContainer.style.top = -editorScroll.scrollTop+"px";
            })
            document.addEventListener("scroll", function(){
                caretContainer.style.top = -document.documentElement.scrollTop+"px";
            })
            document.addEventListener("selectionchange", selectionChangeAction);
        }
    }
    function getDocs() {
        $.ajax({
            type: "GET",
            url: baseUrl + "/"+editorType+"/" + coeditId,
            cache: false,
            success: function (response) {
                let response_body = JSON.parse(response);
                let response_doc = response_body[editorType];
                let content = response_doc["content"];
                clientVersion = response_doc["version"];
                let response_patches = response_body["patchInfos"];
                if (response_patches.length >= 1) {
                    console.log(response_patches);
                    console.log(response_doc);
                    content = patchDocs(response_patches,content,clientVersion);
                } 
                editor.innerHTML = content;
                prevText = content;
                synchronized = true;
                connect();
            }
        });
    }
    function connect() {
        let socket = new SockJS(baseUrl + '/docs-websocket');
        stompClient = Stomp.over(socket);
        stompClient.connect({}, function (frame) {
            clientSessionId = /\/([^\/]+)\/websocket/.exec(socket._transport.url)[1];
            setConnected(true);
            accountLogin(baseUrl,editorType,coeditId,clientSessionId);
            stompClient.subscribe('/topic/'+ editorType + "/" + coeditId, function (content) {
                let response_body = JSON.parse(content.body);
                receiveContent(response_body) //
            });
            stompClient.subscribe('/topic/'+ editorType +'/position/'+coeditId, function(content){
                let contentBody = JSON.parse(content.body);
                if(contentBody.sessionId != clientSessionId){
                    CaretVis.setUserCaret(editor, editorScroll, contentBody.sessionId, contentBody.start, contentBody.end);
                }
            });
            stompClient.subscribe('/topic/'+ editorType +'/'+coeditId+"/accounts", function(content){
                let accounts = JSON.parse(content.body);
                setAccountTable(accounts);
            });
        }, function(message) {
            // check message for disconnect
            if(!stompClient.connected){
                console.log(message);
            }
        });
    }

    const selectionChangeAction = function(){
        if(cursorInterval != null){
            clearInterval(cursorInterval);
        }
        if(intervalCount == 50){
            sendCursorPos();
        }
        cursorInterval = setInterval(sendCursorPos, 200);
        intervalCount++;
    }

    const sendCursorPos = function(){
        intervalCount = 0;
        getCaret();
        stompClient.send('/topic/'+ editorType +'/position/'+coeditId, {}, JSON.stringify({sessionId: clientSessionId, start: startCaret, end: endCaret}));
        clearInterval(cursorInterval);
    }

    function mouseupAction(){
        getCaret();
    }
    function getCaret(){
        let tempCaret = Caret.getCaretPosition(editor);
        startCaret = tempCaret[0];
        endCaret = tempCaret[1];
    }

    function clickAction(){
        getCaret();
    
        if(synchronized){
            prevText = editor.innerHTML;
        }
    }
    
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
            sendPatch(prevText,editor.innerHTML, false);
        } 
        else{
            let diff = dmp.diff_main(pprevText, editor.innerHTML, true);
            dmp.diff_cleanupSemantic(diff);
            if ((diff.length > 1) || (diff.length == 1 && diff[0][0] != 0)) { // 1 이상이어야 변경 한 것이 있음
                let res = setDiff(diff)[0];    
                if (!(Hangul.disassemble(res[2]).length == Hangul.disassemble(res[1]).length + 1) || (keycode == "Backspace" || keycode == "Delete")) {
                    if(!isPaste){
                    setHangulSelection(res)
                    }
                }
            }
        }
    }

    function keyupAction(e){
        if(e.keycode == 'Backspace'){
            selectionChangeAction();
        }
        getCaret();
    }

    function sendContentPost(patchText) {
        let reqBody = {
            "socketSessionId": clientSessionId,
            "docsId": coeditId,
            "clientVersion": clientVersion,
            "patchText": patchText 
        }
        $.ajax({
            async: true, // false 일 경우 동기 요청으로 변경
            type: "POST",
            contentType: "application/json",
            url: baseUrl + "/"+editorType+"/" + coeditId,
            data: JSON.stringify(reqBody),
            dataType: 'json',
            success: function (response) {
            }
        });
    }

    function setHangulSelection(resDiff){
        let startIdx = resDiff[0];
        let inputString = resDiff[1].trim();
        let deleteString = resDiff[2].trim();
        if(isHangul(inputString)){
            let isWriting = (startCaret == endCaret)? false : true;
            if(inputString.length == 2 ){
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
            }
            endCaret = (startCaret == endCaret)? endCaret+1 : endCaret;
            Caret.setCaretPosition(editor,startCaret,endCaret);
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

    function sendPatch(prev,current, isBuffer) {
        let diff = dmp.diff_main(prev, current, true);
        dmp.diff_cleanupSemantic(diff);
        if ((diff.length > 1) || (diff.length == 1 && diff[0][0] != 0)) { // 1 이상이어야 변경 한 것이 있음
            let res = setDiff(diff)[0];
            let isBadChim = (endCaret-startCaret==1) ? !(Hangul.disassemble(res[2]).length == Hangul.disassemble(res[1]).length + 1) : true
            if ( isBadChim || (keycode == "Backspace" || keycode == "Delete")) { 
                if(!isBuffer && !isPaste){
                    setHangulSelection(res)
                }
                
                synchronized = false;
                let inputLength = (res[1].length ==0 ) ? 0 : res[1].length-1;
                let deleteLength =(res[2].length ==0 ) ? 0 : 1-res[2].length;
                let patch_list = dmp.patch_make(prev, current, diff);
                let patch_text = dmp.patch_toText(patch_list);
                sendContentPost(patch_text);
                prevText = editor.innerHTML;
            }
            keycode = "";
            isPaste = false;
            
        }
        else{
            //TODO 변경한거 없다고 잡는 경우가 있다 제자리 변경 그경우 고려해야함        console.log(diff)
        }
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
                        if(removeTags(element[1]).length>0 && element[1].indexOf("</p>") != 0){
                            idx++;
                        }
                        res.push([idx, insertString, deleteString]);
                        insertString = "";
                        deleteString = "";
                    }
                    if(element[1].match(/<\p>$/gi)){
                        idx--;
                    }
                    idx += removeTags(element[1]).length;
                    break;
                case -1: // delete
                    isCycle = true;
                    if(element[1].match(/^<\p>/gi)){
                        idx--;
                    }
                    if(element[1].match(/<\p>$/gi)){
                        idx--;
                    }
                    if(element[1]=="<br>"){ // TODO 지금 에디터가 한 줄이 삭제시 <br> 태그를 넣어버림
                        idx++;
                    }
                    deleteString = removeTags(element[1]);
                    break;
                case 1: // insert
                    isCycle = true;
                    if(element[1]=="<br>"){ // TODO 지금 에디터가 한 줄이 삭제시 <br> 태그를 넣어버림
                        idx++;
                    }
                    insertString = removeTags(element[1]);
                    break;
            }
        });
        if (isCycle) {
            res.push([idx, insertString, deleteString])
            
        }
        return res;
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
                if(originHTML != result){
                    getCaret();
                    let diff = dmp.diff_main(prevText,originHTML, true);
                    let patches = dmp.patch_make(diff);
                    if(patches.length > 0){
                        result = dmp.patch_apply(patches, result)[0];
                    }
                    diff = dmp.diff_main(originHTML, result, true);
                    dmp.diff_cleanupSemantic(diff);        
                    editor.innerHTML = result;
                    let setDiffs = setDiff(diff);
                    let tempCaret=Caret.calcCaret(setDiffs,startCaret,endCaret);
                    startCaret = tempCaret[0];
                    endCaret = tempCaret[1];
                    Caret.setCaretPosition(editor,startCaret,endCaret);
                }   
            }
            else{
                clientVersion = response_patcheInfos[0].patchVersion;
            }
            synchronized = true;
            sendPatch(prevText,originHTML, true);  
            if(result != null){
                prevText = result;
            }
        } 
        if(receiveSessionId != clientSessionId && synchronized){
            getCaret();
            let result;
            if(response_patcheInfos.length > 1){ // 꼬여서 다시 부를 떄
                let snapshotText = response_body.snapshotText;
                let snapshotVersion = response_body.snapshotVersion;
                result = patchDocs(response_patcheInfos,snapshotText,snapshotVersion);
            }
            else{
                result = patchDocs(response_patcheInfos,originHTML,clientVersion);
            }
            let diff = dmp.diff_main(originHTML, result, true);
            dmp.diff_cleanupSemantic(diff);
            editor.innerHTML = result;       
            let setDiffs = setDiff(diff);
            let tempCaret=Caret.calcCaret(setDiffs,startCaret,endCaret);
            startCaret = tempCaret[0];
            endCaret = tempCaret[1];
            Caret.setCaretPosition(editor,startCaret,endCaret);
            prevText = result;
        }
    }

    function patchDocs(response_patches,content,startClientVersion) {
        let result = content;
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
        return result;
    }

    function removeTags(text){
        let resText = text.replace(/<\/p>/ig, " "); //엔터에 대한 계산위한용도
        resText = resText.replace("&nbsp;"," ");
        resText = resText.replace(/<(\/)?([a-zA-Z]*)(\s[a-zA-Z]*=[^>]*)?(\s)*(\/)?>/ig, "");
        return resText;
    }

    const disconnect =function () {
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
    /*
    TODO : account 파일로 추출;
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
        Object.assign(currentCaretUser, CaretVis.getCaretWrappers());
        accounts.forEach(function (account){
            row = "<tr><td>"+account.clientSessionId
            +"</td><td>"+account.remoteAddress
            +"</td></tr>";
            totalRow += row;
            if(account.clientSessionId in currentCaretUser){
                delete currentCaretUser[account.clientSessionId];
            }
        });
        Object.keys(currentCaretUser).forEach(function(key) {
            CaretVis.removeCaret(key);
            CaretVis.removeDrags(key);
        });
        tableBody.innerHTML = totalRow;
    }
    const coedit = {
        setEditor : setEditor,
        disconnect : disconnect
    };
    if (typeof define == 'function' && define.amd) {
        define(function(){
          return coedit;
        });
      } else if (typeof module !== 'undefined') {
        module.exports = coedit;
      } else {
        window.Coedit = coedit;
      }
})();
