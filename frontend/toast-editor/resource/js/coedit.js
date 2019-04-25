(function(){
    const baseUrl = "http://10.77.34.204:8080";
    const coeditId = 2;//location.href.substr(location.href.lastIndexOf('?') + 1);
    const dmp = new diff_match_patch();
    const editorType = "docs";
    let editor;
    let editorScroll;
    let synchronized = false; 
    let clientVersion;
    let stompClient;
    let clientSessionId;
    let prevText = "";
    let pprevText;  
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
            tuiEditor.eventManager.listen("change", inputAction);
            tuiEditor.eventManager.listen("keyup", keyupAction);
            tuiEditor.eventManager.listen("paste" , function(){
                isPaste = true;
            });

            editorScroll.addEventListener("scroll", function(){
                CaretVis.getCaretContainer().style.top = `${-editorScroll.scrollTop}px`;
            })
            document.addEventListener("scroll", function(){
                CaretVis.getCaretContainer().style.top = `${-document.documentElement.scrollTop}px`;
            })
            document.addEventListener("selectionchange", selectionChangeAction);
        }
    }

    function updatePrevText(){
        prevText = editor.innerHTML;
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
                console.log(responsePatches)
                console.log(content)
                editor.innerHTML = content;
                updatePrevText();
                pprevText = content;
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
            // TODO check message for disconnect
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
        const [startCaret, endCaret] = Caret.getCaretPosition(editor);
        stompClient.send(`/topic/${editorType}/position/${coeditId}`, {}, JSON.stringify({sessionId: clientSessionId, start: startCaret, end: endCaret}));
        clearInterval(cursorInterval);
    }
    function keydownAction(event){
        console.log("keydown");
        keycode = event.data.code;
        pprevText = editor.innerHTML;
    }

    function inputAction(){
        console.log("change");
        console.log(prevText);
        console.log(editor.innerHTML);
        if (synchronized) {
            
            sendPatch(prevText,editor.innerHTML, false);
        } 
        else{
            let diff = dmp.diff_main(pprevText, editor.innerHTML, true);
            dmp.diff_cleanupSemantic(diff);
            if ((diff.length > 1) || (diff.length == 1 && diff[0][0] != 0)) { // 1 이상이어야 변경 한 것이 있음
                let res = makeCustomDiff(diff)[0];    
                // TODO :: 조건문 함수로 정의하기!
                if (!(Hangul.disassemble(res[2]).length == Hangul.disassemble(res[1]).length + 1) || (keycode == "Backspace" || keycode == "Delete")) {
                    if(!isPaste){
                        setHangulSelection(res)
                    }
                }
            }
        }
    }

    function keyupAction(event){
        if(event.data.code == 'Backspace'){
            selectionChangeAction();
        }
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
            url: `${baseUrl}/${editorType}/${coeditId}`,
            data: JSON.stringify(reqBody),
            dataType: 'json',
            success: function (response) {
            }
        });
    }

    function setHangulSelection(resDiff){
        
        let inputString = resDiff[1].trim();
        const inputSpace = resDiff[1].length - inputString.length;
        let deleteString = resDiff[2].trim();
        let [tempStartCaret, tempEndCaret] = Caret.getCaretPosition(editor);
        let startCaret = resDiff[0]+inputSpace;
        let endCaret = startCaret +(tempEndCaret - tempStartCaret);
        //TODO 맨앞자리 할지 맨뒬자리 할지 고민
        if(isHangul(inputString)){
            const isWriting = (startCaret != endCaret)? true : false;
            if(inputString.length == 2 ){
                startCaret +=1;
                endCaret = startCaret+1;
            }
            else{
                if(isWriting && !Hangul.isCompleteAll(inputString)){
                    if(Hangul.isCho(inputString)||Hangul.isVowel(inputString)){
                        if(endCaret-startCaret>1){
                            endCaret+=(1-deleteString.length);                
                        }
                        else{
                        startCaret -=deleteString.length;
                        endCaret -=deleteString.length;
                        }
                    }
                }
                startCaret += inputString.length-1;
            endCaret += inputString.length-1;
            }
            endCaret = (startCaret == endCaret)? endCaret+1 : endCaret;
            
            Caret.setCaretPosition(editor,startCaret,endCaret);
            // console.log(`sc ${startCaret} ec ${endCaret}`)
        }
    }

    function isHangul(inputText){
        const c = inputText.charCodeAt(0);
        if( 0x1100<=c && c<=0x11FF ) return true;
        if( 0x3130<=c && c<=0x318F ) return true;
        if( 0xAC00<=c && c<=0xD7A3 ) return true;
        return false;
    }

    function sendPatch(prev,current, isBuffer) {
        const [startCaret, endCaret] = Caret.getCaretPosition(editor);
        const diff = dmp.diff_main(prev, current, true);
        dmp.diff_cleanupSemantic(diff);
        if ((diff.length > 1) || (diff.length == 1 && diff[0][0] != 0)) { // 1 이상이어야 변경 한 것이 있음
            const res = makeCustomDiff(diff)[0];
            const isBadChim = (endCaret-startCaret==1) ? !(Hangul.disassemble(res[2]).length == Hangul.disassemble(res[1]).length + 1) : true
            if ( isBadChim || (keycode == "Backspace" || keycode == "Delete")) { 
                if(!isBuffer && !isPaste){
                    setHangulSelection(res)
                }
                
                synchronized = false;
                sendContentPost(dmp.patch_toText(dmp.patch_make(prev, current, diff)));
                updatePrevText()
            }
            keycode = "";
            isPaste = false;
        }
    }

    function makeCustomDiff(diff) {
        const res = [];
        let idx = 0;
        let insertString = "";
        let deleteString = "";
        let isCycle = false;
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
            const lastOpenTag = convertedDiff[i][1].lastIndexOf("<");
            const lastCloseTag = convertedDiff[i][1].lastIndexOf(">");
            // 마지막에 < 로 열렸는데 >로 닫히지 않은 경우
            if(lastCloseTag < lastOpenTag) {
                let nextFirstCloseTag = convertedDiff[i+1][1].indexOf(">") + 1;
                convertedDiff[i][1] += convertedDiff[i+1][1].substring(0, nextFirstCloseTag);
                convertedDiff[i+1][1] = convertedDiff[i+1][1].substring(nextFirstCloseTag, convertedDiff[i+1][1].length);
            
                // 현재 마지막이 <br>로 끝나고 다음 줄 시작이 </div> 인 경우
                const lastTag = convertedDiff[i][1].substring(convertedDiff[i][1].lastIndexOf("<"), convertedDiff[i][1].lastIndexOf(">") + 1);
                if(lastTag == "<br>") {
                    nextFirstCloseTag = convertedDiff[i+1][1].indexOf(">") + 1;
                    const nextFirstTag = convertedDiff[i+1][1].substring(0, nextFirstCloseTag);
                    if(nextFirstTag == "</div>"){
                        convertedDiff[i][1] += "</div>";
                        convertedDiff[i+1][1] = convertedDiff[i+1][1].substring(nextFirstCloseTag, convertedDiff[i+1][1].length);
                    }
                } 
            }

        }
        return convertedDiff;
    }

    function receiveContent(responseBody) {
        tuiEditor.eventManager.emit("change");
        const receiveSessionId = responseBody.socketSessionId;
        const responsePatcheInfos = responseBody.patchInfos;
        const originHTML = editor.innerHTML;
        let result;
        const [startCaret, endCaret] = Caret.getCaretPosition(editor);
        // console.log(`first sc : ${startCaret} ec : ${endCaret}`)
        if (receiveSessionId == clientSessionId) {
            if(responsePatcheInfos.length > 1){ // 꼬여서 다시 부를 떄
                let snapshotText = responseBody.snapshotText;
                let snapshotVersion = responseBody.snapshotVersion;
                result = patchDocs(responsePatcheInfos,snapshotText,snapshotVersion);
                if(originHTML != result){
                    let diff = dmp.diff_main(prevText,originHTML, true);
                    let patches = dmp.patch_make(diff); 
                    if(patches.length > 0){
                        result = dmp.patch_apply(patches, result)[0];
                    }
                    diff = dmp.diff_main(originHTML, result, true);
                    dmp.diff_cleanupSemantic(diff);     
                    editor.innerHTML = result;
                    let convertedDiff = checkValidDiff(diff);
                    let makeCustomDiffs = makeCustomDiff(convertedDiff);
                    //console.log(`지꺼1 sc : ${startCaret} ec : ${endCaret}`)
                    const [clacStartCaret, clacEndCaret] = Caret.calcCaret(makeCustomDiffs,startCaret,endCaret);
                    //console.log(`지꺼2 sc : ${clacStartCaret} ec : ${clacEndCaret}`)
                    Caret.setCaretPosition(editor,clacStartCaret,clacEndCaret);
                }   
            }
            else{
                clientVersion = responsePatcheInfos[0].patchVersion;
            }
            synchronized = true;
            console.log(prevText);
            console.log(originHTML);
            sendPatch(prevText,originHTML, true);  
            updatePrevText();
        } 
        if(receiveSessionId != clientSessionId && synchronized){
            let result;
            if(responsePatcheInfos.length > 1){ // 꼬여서 다시 부를 떄
                result = patchDocs(responsePatcheInfos, responseBody.snapshotText, responseBody.snapshotVersion);
            }
            else{
                result = patchDocs(responsePatcheInfos,originHTML,clientVersion);
            }
            const diff = dmp.diff_main(originHTML, result, true);
            dmp.diff_cleanupSemantic(diff);
            editor.innerHTML = result;
            const convertedDiff = checkValidDiff(diff);       
            const makeCustomDiffs = makeCustomDiff(convertedDiff);
            // console.log(`남1 sc : ${startCaret} ec : ${endCaret}`)
            const [clacStartCaret, clacEndCaret] = Caret.calcCaret(makeCustomDiffs,startCaret,endCaret);
            // console.log(`남2 sc : ${clacStartCaret} ec : ${clacEndCaret}`)
            Caret.setCaretPosition(editor,clacStartCaret,clacEndCaret);
            updatePrevText();
        }
    }

    function patchDocs(responsePatches,content,startClientVersion) {
        let result = content;
        responsePatches.forEach(function (item, index, array) {
            const patches = dmp.patch_fromText(item.patchText);
            if (startClientVersion < item.patchVersion) {
                result = dmp.patch_apply(patches, result)[0];
                startClientVersion += 1;
            }
            if (index == (array.length - 1) && patches.length != 0) {
                clientVersion = item.patchVersion;
            }
            
        });
        return result;
    }

    function removeTags(text){
        let temp =  text.replace(/<\/div>/ig, " ")
        temp=temp.replace(/&nbsp;/gi," ")
        temp= temp.replace(/<(\/)?([a-zA-Z]*)(\s[a-zA-Z]*=[^>]*)?(\s)*(\/)?>/ig, "");
        return temp;
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
            row  = `<tr><td>${account.clientSessionId}</td><td>${account.remoteAddress}</td></tr>`
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
