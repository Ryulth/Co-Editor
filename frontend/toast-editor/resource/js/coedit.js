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
                    Caret.setCaretPosition(editor, startCaret, startCaret);
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
            Caret.setCaretPosition(editor, startCaret, endCaret + 1);
        }
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
        for (var i = 0; i < convertedDiff.length - 1; i++) {
            const lastOpenTag = convertedDiff[i][1].lastIndexOf("<");
            const lastCloseTag = convertedDiff[i][1].lastIndexOf(">");
            if(convertedDiff[i][0] !== -1) {
                // 마지막에 < 로 열렸는데 >로 닫히지 않은 경우
                if (lastCloseTag < lastOpenTag) {
                    const nextIndex = getNextIndex(i + 1, convertedDiff);
                    let nextFirstCloseTag = convertedDiff[nextIndex][1].indexOf(">") + 1;
                    convertedDiff[i][1] += convertedDiff[nextIndex][1].substring(0, nextFirstCloseTag);
                    convertedDiff[nextIndex][1] = convertedDiff[nextIndex][1].substring(nextFirstCloseTag, convertedDiff[nextIndex][1].length);
    
                    // 현재 마지막이 <br>로 끝나고 다음 줄 시작이 </div> 인 경우
                    const lastTag = convertedDiff[i][1].substring(convertedDiff[i][1].lastIndexOf("<"), convertedDiff[i][1].lastIndexOf(">") + 1);
                    if (lastTag === "<br>") {
                        nextFirstCloseTag = convertedDiff[nextIndex][1].indexOf(">") + 1;
                        const nextFirstTag = convertedDiff[nextIndex][1].substring(0, nextFirstCloseTag);
                        if (nextFirstTag === "</div>" || nextFirstTag === "</li>") {
                            convertedDiff[i][1] += nextFirstTag;
                            convertedDiff[nextIndex][1] = convertedDiff[nextIndex][1].substring(nextFirstCloseTag, convertedDiff[nextIndex][1].length);
                        }
                    }
                }
            } else {
                if (lastCloseTag < lastOpenTag) {
                    convertedDiff[i][1] = "<" + convertedDiff[i][1] + ">";
                }
            }

        }
        return convertedDiff;
    }

    function getNextIndex(index, convertedDiff) {
        while (convertedDiff[index][0] === -1) {
            index++;
        }
        return index;
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
        const [startCaret, endCaret] = Caret.getCaretPosition(editor);
        const diff = dmp.diff_main(source, target, true);
        dmp.diff_cleanupSemantic(diff);
        editor.innerHTML = target;
        const convertedDiff = checkValidDiff(diff);
        const makeCustomDiffs = makeCustomDiff(convertedDiff);
        const [clacStartCaret, clacEndCaret] = Caret.calcCaret(makeCustomDiffs, startCaret, endCaret);
        Caret.setCaretPosition(editor, clacStartCaret, clacEndCaret);
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
        return text.replace(/<\/div>/ig, " ")
        .replace(/<\/th>/ig, " ")
        .replace(/<\/td>/ig, " ")
        .replace(/<\/li>/ig, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/<(\/)?([a-zA-Z]*)(\s[a-zA-Z]*=[^>]*)?(\s)*(\/)?>/ig, "")
        .replace(/(<([^>]+)>)/ig,"");
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
        disconnect: disconnect
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