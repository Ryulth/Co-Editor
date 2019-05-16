(function() {
    const baseUrl = "http://10.77.34.205:8080";
    const coeditId = 2; //location.href.substr(location.href.lastIndexOf('?') + 1);
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
    let cursorInterval;
    let intervalCount = 0;
    var isComposing = false;

    function setEditor(tuiEditor) {
        CaretVis.init();
        editorScroll = tuiEditor.wwEditor.$editorContainerEl[0];
        editor = tuiEditor.wwEditor.editor._root;
        getDocs();
        if (editor.addEventListener) {
            tuiEditor.eventManager.listen("keydown", keydownAction)
            tuiEditor.eventManager.listen("change", inputAction);
            tuiEditor.eventManager.listen("keyup", keyupAction);

            editor.addEventListener("input", function(e) {
                isComposing = e.isComposing;
                if (isComposing) {
                    setComposingCaret();
                }
            })
            tuiEditor.eventManager.listen('command', function(e, argument){
                // 테이블과 헤딩태그 추가 팝업창의 경우 기능 완료 후 안닫히는 문제가 있었음
                console.log(e);
                console.log(argument);
                if(e === 'Table'){
                    tuiEditor._ui._popups[2].hide();
                } else if(e === 'Heading'){
                    tuiEditor._ui._popups[3].hide();
                }
            })
            
            editor.addEventListener("compositionstart", function(e) {
                isComposing = true;
            })
            editor.addEventListener("compositionupdate", function(e) {
                isComposing = true;
            })
            tuiEditor.eventManager.listen("wysiwygRangeChangeAfter", inputAction);
            editor.addEventListener("compositionend", function(e) {
                isComposing = false;
                const [startCaret, endCaret] = Caret.getCaretPosition(editor);
                if (startCaret !== endCaret) {
                    if(isWindows()){
                        Caret.setCaretPosition(editor, startCaret, startCaret);
                    } else if(isMacintosh()){
                        Caret.setCaretPosition(editor, endCaret, endCaret);
                    }
                    
                }
            })
            editorScroll.addEventListener("scroll", function() {
                CaretVis.getCaretContainer().style.top = `${-editorScroll.scrollTop}px`;
            })
            document.addEventListener("scroll", function() {
                CaretVis.getCaretContainer().style.top = `${-document.documentElement.scrollTop}px`;
            })
            document.addEventListener("selectionchange", selectionChangeAction);
        }
    }

    function setComposingCaret() {
        const [startCaret, endCaret] = Caret.getCaretPosition(editor);
        if (startCaret === endCaret) {
            if(isWindows()){
                Caret.setCaretPosition(editor, startCaret, endCaret + 1);
            } else if(isMacintosh()){
                Caret.setCaretPosition(editor, startCaret - 1, endCaret);
            }
        }
    }

    function isMacintosh() {
        return navigator.platform.indexOf('Mac') > -1
    }
      
    function isWindows() {
        return navigator.platform.indexOf('Win') > -1
    }

    function updatePrevText() {
        prevText = editor.innerHTML;
    }

    function getDocs() {
        $.ajax({
            type: "GET",
            url: `${baseUrl}/${editorType}/${coeditId}`,
            cache: false,
            success: function(response) {
                const responseBody = JSON.parse(response);
                const responseDoc = responseBody[editorType];
                let content = responseDoc.content;
                clientVersion = responseDoc.version;
                const responsePatches = responseBody.patchInfos;
                if (responsePatches.length >= 1) {
                    content = patchDocs(responsePatches, content, clientVersion);
                }
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
        stompClient.connect({}, function(frame) {
            clientSessionId = /\/([^\/]+)\/websocket/.exec(socket._transport.url)[1];
            setConnected(true);
            accountLogin(baseUrl, editorType, coeditId, clientSessionId);
            stompClient.subscribe(`/topic/${editorType}/${coeditId}`, function(content) {
                let responseBody = JSON.parse(content.body);
                console.log("receive");
                receiveContent(responseBody);
            });
            stompClient.subscribe(`/topic/${editorType}/position/${coeditId}`, function(content) {
                let contentBody = JSON.parse(content.body);
                if (contentBody.sessionId !== clientSessionId) {
                    CaretVis.setUserCaret(editor, editorScroll, contentBody.sessionId, contentBody.start, contentBody.end);
                }
            });
            stompClient.subscribe(`/topic/${editorType}/${coeditId}/accounts`, function(content) {
                let accounts = JSON.parse(content.body);
                setAccountTable(accounts);
            });
        }, function(message) {
            // TODO check message for disconnect
            if (!stompClient.connected) {
                console.log(message);
            }
        });
    }

    function selectionChangeAction() {
        if (cursorInterval !== null && cursorInterval !== undefined) {
            clearInterval(cursorInterval);
        }
        if (intervalCount === 50) {
            sendCursorPos();
        }
        cursorInterval = setInterval(sendCursorPos, 200);
        intervalCount++;
    }

    function sendCursorPos() {
        intervalCount = 0;
        const [startCaret, endCaret] = Caret.getCaretPosition(editor);
        stompClient.send(`/topic/${editorType}/position/${coeditId}`, {}, JSON.stringify({
            sessionId: clientSessionId,
            start: startCaret,
            end: endCaret
        }));
        clearInterval(cursorInterval);
    }

    function keydownAction(event) {
        isComposing = event.isComposing;
        if (isComposing) {
            setComposingCaret();
        }
        pprevText = editor.innerHTML;
    }

    function inputAction() {
        if (synchronized) {
            sendPatch(prevText, editor.innerHTML);
        }
    }

    function keyupAction(event) {
        if (event.data.code === 'Backspace') {
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
            success: function(response) {}
        });
    }

    function sendPatch(prev, current) {
        const diff = dmp.diff_main(prev, current, true);
        dmp.diff_cleanupSemantic(diff);
        if ((diff.length > 1) || (diff.length === 1 && diff[0][0] !== 0)) { // 1 이상이어야 변경 한 것이 있음
            synchronized = false;
            sendContentPost(dmp.patch_toText(dmp.patch_make(prev, current, diff)));
            updatePrevText()
        }
    }

    function makeCustomDiff(diff) {
        const res = [];
        let idx = 0;
        let insertString = "";
        let deleteString = "";
        let isCycle = false;
        diff.forEach(function(element) {
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

    function receiveContent(responseBody) {
        if (isComposing && pprevText !== editor.innerHTML) {
            setComposingCaret();
        }
        tuiEditor.eventManager.emit("change");
        const receiveSessionId = responseBody.socketSessionId;
        const responsePatcheInfos = responseBody.patchInfos;
        const originHTML = editor.innerHTML;
        let result
        if(responseBody.serverVersion <= clientVersion){
            return;
        }
        if (receiveSessionId === clientSessionId) {
            if (responsePatcheInfos.length > 1) { // 꼬여서 다시 부를 떄
                result = patchDocs(responsePatcheInfos, responseBody.snapshotText, responseBody.snapshotVersion);
                if (originHTML !== result) {
                    result = dmp.patch_apply(dmp.patch_make(dmp.diff_main(prevText, originHTML, true)), result)[0];
                }
                setCaretPositionFromDiff(originHTML, result);
            } else {
                clientVersion = responsePatcheInfos[0].patchVersion;
            }
            synchronized = true;
            sendPatch(prevText, originHTML);
            updatePrevText();
        } else if (synchronized) {
            if (responsePatcheInfos.length > 1) { // 꼬여서 다시 부를 떄
                result = patchDocs(responsePatcheInfos, responseBody.snapshotText, responseBody.snapshotVersion);
            } else {
                result = patchDocs(responsePatcheInfos, originHTML, clientVersion);
            }
            setCaretPositionFromDiff(originHTML, result);
            updatePrevText();
        }
    }

    function setCaretPositionFromDiff(source, target) {
        // innerHTML을 업데이트하면 열려있던 팝업창이 닫혀 기존에 열려있는 팝업창을 저장해야함
        const popupModal = getShownPopupModalInfo();  

        const [startCaret, endCaret] = Caret.getCaretPosition(editor);
        const diff = dmp.diff_main(removeTags(source), removeTags(target), true);
        dmp.diff_cleanupSemantic(diff);
        editor.innerHTML = target;
        Caret.setCaretPosition(editor, startCaret, endCaret);
        const makeCustomDiffs = makeCustomDiff(diff);
        const [clacStartCaret, clacEndCaret] = Caret.calcCaret(makeCustomDiffs, startCaret, endCaret);
        Caret.setCaretPosition(editor, clacStartCaret, clacEndCaret);

        // 저장 된 팝업창을 다시 열어줘야함.
        resetShownPopupModalInfo(popupModal);
    }

    function getShownPopupModalInfo(){
        const popupModal = {};
        for(tempPopupModal of tuiEditor._ui._popups){
            if(tempPopupModal.isShow()){
                popupModal.$el = tempPopupModal;
                if(tempPopupModal._id === 25){
                    // URL 링크
                    popupModal.$data.$linkText = tempPopupModal._inputText.value;
                    popupModal.$data.$linkUrl = tempPopupModal._inputURL.value;
                } else if(tempPopupModal.id === 26){
                    // 이미지
                    popupModal.$data.$imageUrl = tempPopupModal._$imageUrlInput.val();
                    popupModal.$data.$description = tempPopupModal._$altTextInput.val();
                }
                if(tempPopupModal._id !== 28){
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(tuiEditor.wwEditor.getEditor().getSelection());
                }
            }
        }
        return popupModal;
    }

    function resetShownPopupModalInfo(popupModal){
        if(popupModal.$el !== undefined){
            popupModal.$el.show();
            if(popupModal.$el._id === 25){
                // URL 링크
                popupModal.$el._inputText.value = popupModal.$data.$linkText;
                popupModal.$el._inputURL.value = popupModal.$data.$linkUrl;
            } else if(popupModal.$el.id === 26){
                // 이미지
                popupModal.$el._$imageUrlInput.val(popupModal.$data.$imageUrl);
                popupModal.$el._$altTextInput.val(popupModal.$data.$description);
            }
        }
    }

    function patchDocs(responsePatches, content, startClientVersion) {
        let result = content;
        responsePatches.forEach(function(item, index, array) {
            const patches = dmp.patch_fromText(item.patchText);
            if (startClientVersion < item.patchVersion) {
                result = dmp.patch_apply(patches, result)[0];
                startClientVersion += 1;
            }
            if (index === (array.length - 1) && patches.length !== 0) {
                clientVersion = item.patchVersion;
            }

        });
        return result;
    }

    function removeTags(text) {
        return $('<textarea/>').html(text.replace(/<\/div>/ig, " ")
            .replace(/<\/th>/ig, " ")
            .replace(/<\/td>/ig, " ")
            .replace(/<\/li>/ig, " ")
            .replace(/&nbsp;/gi, " ")
            .replace(/<(\/)?([a-zA-Z]*)(\s[a-zA-Z]*=[^>]*)?(\s)*(\/)?>/ig, "")
            .replace(/(<([^>]+)>)/ig,"")).text();
    }

    function disconnect() {
        if (stompClient !== null && stompClient !== undefined) {
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
    function accountLogout(baseUrl, type, id, clientSessionId) {
        $.ajax({
            async: true, // false 일 경우 동기 요청으로 변경
            type: "DELETE",
            contentType: "application/json",
            url: `${baseUrl}/${type}/${id}/accounts/${clientSessionId}`,
            success: function(response) {}
        });
    }

    function accountLogin(baseUrl, type, id, clientSessionId) {
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
            success: function(response) {}
        });
    }

    function getAccounts(baseUrl, type, id) {
        $.ajax({
            type: "GET",
            cache: false,
            url: `${baseUrl}/${type}/${id}/accounts`,
            success: function(response) {
                console.log(JSON.parse(response))
                setAccountTable(JSON.parse(response));
            }
        });
    }

    function setAccountTable(accounts) {
        tableBody = document.getElementById("accounts-table-body");
        totalRow = "";
        let currentCaretUser = {};
        Object.assign(currentCaretUser, CaretVis.getCaretWrappers());
        accounts.forEach(function(account) {
            row = `<tr><td>${account.clientSessionId}</td><td>${account.remoteAddress}</td></tr>`
            totalRow += row;
            if (account.clientSessionId in currentCaretUser) {
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
        setEditor: setEditor,
        disconnect: disconnect,
    };

    if (typeof define === 'function' && define.amd) {
        define(function() {
            return coedit;
        });
    } else if (typeof module !== 'undefined') {
        module.exports = coedit;
    } else {
        window.Coedit = coedit;
    }
})();