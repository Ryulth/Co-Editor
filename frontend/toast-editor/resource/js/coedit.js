(function(){
    const baseUrl = "http://10.77.34.203:8080";
    const coeditId = 2;//location.href.substr(location.href.lastIndexOf('?') + 1);
    const dmp = new diff_match_patch();
    const editorType = "docs";
    let editor;
    let editorScroll;
    let synchronized = true; 
    let clientVersion;
    let stompClient;
    let clientSessionId;
    let prevText = "<div><br></div>";
    let pprevText;  
    let startCaret =0;
    let endCaret =0;
    let keycode = "";
    let isPaste = false;
    let cursorInterval;
    let intervalCount = 0;

    function setEditor(tuiEditor){
        CaretVis.init();
        editorScroll = tuiEditor.wwEditor.$editorContainerEl[0];
        editor = tuiEditor.wwEditor.editor._root;
        getDocs();
        if (editor.addEventListener) {
            tuiEditor.eventManager.listen("keydown", keydownAction)
            tuiEditor.eventManager.listen("mouseup", mouseupAction);            
            tuiEditor.eventManager.listen("change", inputAction);
            tuiEditor.eventManager.listen("keyup", keyupAction);
            tuiEditor.eventManager.listen("paste" , function(){
                isPaste = true;
            });

            tuiEditor.getUI().getToolbar().$el[0].addEventListener("mousedown",clickAction);

            editorScroll.addEventListener("scroll", function(){
                CaretVis.getCaretContainer().style.top = `${-editorScroll.scrollTop}px`;
            })
            document.addEventListener("scroll", function(){
                CaretVis.getCaretContainer().style.top = `${-document.documentElement.scrollTop}px`;
            })
            document.addEventListener("selectionchange", selectionChangeAction);
        }
    }

    function getDocs() {
        $.ajax({
            type: "GET",
            url: `${baseUrl}/${editorType}/${coeditId}`,
            cache: false,
            success: function (response) {
                const responseBody = JSON.parse(response);
                const responseDoc = responseBody[editorType];
                let content = responseDoc.content;
                clientVersion = responseDoc.version;
                const responsePatches = responseBody.patchInfos;
                if (responsePatches.length >= 1) {
                    content = patchDocs(responsePatches, content, clientVersion);
                } 
                editor.innerHTML = content;
                prevText = content;
                synchronized = true;
                connect();
            }
        });
    }

    function connect() {
        let socket = new SockJS(`${baseUrl}/docs-websocket`);
        stompClient = Stomp.over(socket);
        stompClient.connect({}, function (frame) {
            clientSessionId = /\/([^\/]+)\/websocket/.exec(socket._transport.url)[1];
            setConnected(true);
            accountLogin(baseUrl,editorType,coeditId,clientSessionId);
            stompClient.subscribe(`/topic/${editorType}/${coeditId}`, function (content) {
                let responseBody = JSON.parse(content.body);
                receiveContent(responseBody) 
            });
            stompClient.subscribe(`/topic/${editorType}/position/${coeditId}`, function(content){
                let contentBody = JSON.parse(content.body);
                if(contentBody.sessionId != clientSessionId){
                    CaretVis.setUserCaret(editor, editorScroll, contentBody.sessionId, contentBody.start, contentBody.end);
                }
            });
            stompClient.subscribe(`/topic/${editorType}/${coeditId}/accounts`, function(content){
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

    function selectionChangeAction(){
        if(cursorInterval != null){
            clearInterval(cursorInterval);
        }
        if(intervalCount == 50){
            sendCursorPos();
        }
        cursorInterval = setInterval(sendCursorPos, 200);
        intervalCount++;
    }

    function sendCursorPos(){
        intervalCount = 0;
        getCaret();
        stompClient.send(`/topic/${editorType}/position/${coeditId}`, {}, JSON.stringify({sessionId: clientSessionId, start: startCaret, end: endCaret}));
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
            // prevText = editor.innerHTML;
            // console.log("prev",prevText)
        }
    }
    
    function keydownAction(event){
        keycode = event.data.code;
        getCaret();
        if (synchronized) {
            // prevText =editor.innerHTML;
            // console.log("keydownActionprev",prevText)
        }
        pprevText = editor.innerHTML;
    }

    function inputAction(){
        console.log("inputAction")
        if (synchronized) {
            sendPatch(prevText,editor.innerHTML, false);
        } 
        else{
            console.log("범인")
            let diff = dmp.diff_main(pprevText, editor.innerHTML, true);
            dmp.diff_cleanupSemantic(diff);
            if ((diff.length > 1) || (diff.length == 1 && diff[0][0] != 0)) { // 1 이상이어야 변경 한 것이 있음
                let res = makeCustomDiff(diff)[0];    
                if (!(Hangul.disassemble(res[2]).length == Hangul.disassemble(res[1]).length + 1) || (keycode == "Backspace" || keycode == "Delete")) {
                    if(!isPaste){
                    setHangulSelection(res)
                    }
                }
            }
        }
    }

    function keyupAction(e){
        console.log("keyupAction : ", e);
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
        c = inputText.charCodeAt(0);
        if( 0x1100<=c && c<=0x11FF ) return true;
        if( 0x3130<=c && c<=0x318F ) return true;
        if( 0xAC00<=c && c<=0xD7A3 ) return true;
        return false;
    }

    function sendPatch(prev,current, isBuffer) {
        console.log("sendPAtch");
        // console.log(prev)
        // console.log(current)
        let diff = dmp.diff_main(prev, current, true);
        dmp.diff_cleanupSemantic(diff);
        if ((diff.length > 1) || (diff.length == 1 && diff[0][0] != 0)) { // 1 이상이어야 변경 한 것이 있음
            let res = makeCustomDiff(diff)[0];
            let isBadChim = (endCaret-startCaret==1) ? !(Hangul.disassemble(res[2]).length == Hangul.disassemble(res[1]).length + 1) : true
            if ( isBadChim || (keycode == "Backspace" || keycode == "Delete")) { 
                if(!isBuffer && !isPaste){
                    setHangulSelection(res)
                }
                
                synchronized = false;
                let patchList = dmp.patch_make(prev, current, diff);
                let patchText = dmp.patch_toText(patchList);
                sendContentPost(patchText);
                prevText = editor.innerHTML;
            }
            keycode = "";
            isPaste = false;
        }
    }

    function makeCustomDiff(diff) {
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
                    idx += removeTags(element[1]).length;
                    break;
                case -1: // delete
                    isCycle = true;
                    deleteString = removeTags(element[1]);
                    break;
                case 1: // insert
                    isCycle = true;
                    insertString = removeTags(element[1]);
                    break;
            }
        });
        if (isCycle) {
            res.push([idx, insertString, deleteString])
            
        }
        return res;
    }

    function checkValidDiff(diff) {
        let convertedDiff = diff;
        for(var i = 0; i < convertedDiff.length - 1; i++ ) {
            let lastOpenTag = convertedDiff[i][1].lastIndexOf("<");
            let lastCloseTag = convertedDiff[i][1].lastIndexOf(">");
            // 마지막에 < 로 열렸는데 >로 닫히지 않은 경우
            if(lastCloseTag < lastOpenTag) {
                let nextFirstCloseTag = convertedDiff[i+1][1].indexOf(">") + 1;
                convertedDiff[i][1] += convertedDiff[i+1][1].substring(0, nextFirstCloseTag);
                convertedDiff[i+1][1] = convertedDiff[i+1][1].substring(nextFirstCloseTag, convertedDiff[i+1][1].length);
            
                // 현재 마지막이 <br>로 끝나고 다음 줄 시작이 </div> 인 경우
                let lastTag = convertedDiff[i][1].substring(convertedDiff[i][1].lastIndexOf("<"), convertedDiff[i][1].lastIndexOf(">") + 1);
                if(lastTag == "<br>") {
                    nextFirstCloseTag = convertedDiff[i+1][1].indexOf(">") + 1;
                    let nextFirstTag = convertedDiff[i+1][1].substring(0, nextFirstCloseTag);
                    if(nextFirstTag == "</div>"){
                        convertedDiff[i][1] += "</div>";
                        convertedDiff[i+1][1] = convertedDiff[i+1][1].substring(nextFirstCloseTag, convertedDiff[i+1][1].length);
                    }
                } 
            }

        }
        return convertedDiff;
    }

    function tempValidDiff(diff) {
        let convertedDiff = diff;
        for(var i=0; i<convertedDiff.length - 1; i++){
            let currValue = convertedDiff[i][1];
            let nextValue = convertedDiff[i+1][1];
            let lastChar = currValue.substring(currValue.length - 1, currValue.length);
            let rangeBr = nextValue.substring(0, 3);
            let rangeDiv = nextValue.substring(0, 5);
            let rangeBrDiv = nextValue.substring(0, 9);
            if(lastChar == "<"){
                if(rangeBrDiv == "br></div>"){
                    convertedDiff[i][1] += "br></div>";
                    convertedDiff[i+1][1] = nextValue.substring(9, nextValue.length);
                } else if(rangeBr == "br>") {
                    convertedDiff[i][1] += "br>";
                    convertedDiff[i+1][1] = nextValue.substring(3, nextValue.length);
                } else if(rangeDiv == "/div>"){
                    convertedDiff[i][1] += "/div>";
                    convertedDiff[i+1][1] = nextValue.substring(5, nextValue.length);
                }
            }
        }
        return convertedDiff;
    }

    function receiveContent(responseBody) {
        
        let receiveSessionId = responseBody.socketSessionId;
        let responsePatcheInfos = responseBody.patchInfos;
        let originHTML = editor.innerHTML;
        let result;
        if (receiveSessionId == clientSessionId) {
            if(responsePatcheInfos.length > 1){ // 꼬여서 다시 부를 떄
                let snapshotText = responseBody.snapshotText;
                let snapshotVersion = responseBody.snapshotVersion;
                result = patchDocs(responsePatcheInfos,snapshotText,snapshotVersion);
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
                    console.log("originDiff, ", diff)
                    let convertedDiff = checkValidDiff(diff);
                    console.log("convertedDiff, ", convertedDiff);
                    let makeCustomDiffs = makeCustomDiff(convertedDiff);
                    let tempCaret=Caret.calcCaret(makeCustomDiffs,startCaret,endCaret);
                    startCaret = tempCaret[0];
                    endCaret = tempCaret[1];
                    Caret.setCaretPosition(editor,startCaret,endCaret);
                }   
            }
            else{
                clientVersion = responsePatcheInfos[0].patchVersion;
            }
            synchronized = true;
            console.log("sendpatch onemore")
            sendPatch(prevText,originHTML, true);  
            if(result != null){
                console.log("ressss",result)
                prevText = result;
            }
        } 
        if(receiveSessionId != clientSessionId && synchronized){
            getCaret();
            let result;
            if(responsePatcheInfos.length > 1){ // 꼬여서 다시 부를 떄
                let snapshotText = responseBody.snapshotText;
                let snapshotVersion = responseBody.snapshotVersion;
                result = patchDocs(responsePatcheInfos,snapshotText,snapshotVersion);
            }
            else{
                result = patchDocs(responsePatcheInfos,originHTML,clientVersion);
            }
            let diff = dmp.diff_main(originHTML, result, true);
            dmp.diff_cleanupSemantic(diff);
            editor.innerHTML = result;
            console.log("originDiff, ", diff)
            let convertedDiff = checkValidDiff(diff);       
            console.log("convertedDiff, ", convertedDiff);
            let makeCustomDiffs = makeCustomDiff(convertedDiff);
            let tempCaret=Caret.calcCaret(makeCustomDiffs,startCaret,endCaret);
            startCaret = tempCaret[0];
            endCaret = tempCaret[1];
            Caret.setCaretPosition(editor,startCaret,endCaret);
            prevText = result;
        }
    }

    function patchDocs(responsePatches,content,startClientVersion) {
        let result = content;
        responsePatches.forEach(function (item, index, array) {
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
        return text.replace(/<\/div>/ig, " ") //엔터에 대한 계산위한용도
        .replace("&nbsp;"," ")
        .replace(/<(\/)?([a-zA-Z]*)(\s[a-zA-Z]*=[^>]*)?(\s)*(\/)?>/ig, "");
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
    /*
    TODO : account 파일로 추출;
    */
    function accountLogout(baseUrl,type,id,clientSessionId){
        $.ajax({
            async: true, // false 일 경우 동기 요청으로 변경
            type: "DELETE",
            contentType: "application/json",
            url: `${baseUrl}/${type}/${id}/accounts/${clientSessionId}`,
            success: function (response) {
            }
        });
    }
    function accountLogin(baseUrl,type,id,clientSessionId){
            let reqBody = {
                "clientSessionId": clientSessionId,
                "remoteAddress": ""
            }
            $.ajax({
                async: true, // false 일 경우 동기 요청으로 변경
                type: "POST",
                contentType: "application/json",
                url: `${baseUrl}/${type}/${id}/accounts`,
                data: JSON.stringify(reqBody),
                dataType: 'json',
                success: function (response) {
                }
            });
    }
    function getAccounts(baseUrl,type,id){
        $.ajax({
            type: "GET",
            cache: false,
            url: `${baseUrl}/${type}/${id}/accounts`,
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
