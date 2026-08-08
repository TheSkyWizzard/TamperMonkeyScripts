// ==UserScript==
// @name         Broadcastify Popout Auto-Play & UI Fix
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto-clicks play, monitors stuck connection states, and customizes UI layout
// @match        *://www.broadcastify.com/listen/feed/popout.php*
// @match        *://broadcastify.com/listen/feed/popout.php*
// @run-at       document-end
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    // 1. Inject custom styles to adjust scrollbars, hide unwanted elements, and optimize layout
    const customStyles = `
        html, body, .popout-wrap {
            overflow: hidden !important;
            -ms-overflow-style: none !important;
            scrollbar-width: none !important;
        }
        html::-webkit-scrollbar, body::-webkit-scrollbar {
            display: none !important;
        }
        /* Hidden UI elements */
        div.listen-ad-notice,
        .lp-action-btn.lp-external-link,
        .lp-action-btn .lp-external-link {
            display: none !important;
        }
        .lp-controls {
            display: flex !important;
            flex-wrap: wrap !important;
            justify-content: space-between !important;
            gap: 12px !important;
            width: 100% !important;
            box-sizing: border-box !important;
            padding: 8px 12px !important;
        }
        .lp-control-group {
            flex: 1 1 calc(50% - 6px) !important;
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            margin: 0 !important;
        }
        .lp-control-group input[type="range"] {
            flex: 1 !important;
            width: 100% !important;
            cursor: pointer !important;
        }
        .lp-link-stack {
            flex: 1 1 100% !important;
            margin-top: 6px !important;
        }
    `;

    const styleNode = document.createElement('style');
    styleNode.textContent = customStyles;
    (document.head || document.documentElement).appendChild(styleNode);

    // 2. Direct Auto-play Execution
    function attemptAutoPlay() {
        const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        const playBtn = document.getElementById('lp-play');

        // Check if Broadcastify's JavaScript API is accessible
        if (pageWindow.ListenPlayer && typeof pageWindow.ListenPlayer.play === 'function') {
            try {
                pageWindow.ListenPlayer.play();
                return true;
            } catch (e) {
                // Fallback to DOM manipulation if API call fails
            }
        }

        // DOM Fallback: Trigger standard events on play button
        if (playBtn) {
            ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(eventType => {
                const event = new MouseEvent(eventType, {
                    view: pageWindow,
                    bubbles: true,
                    cancelable: true
                });
                playBtn.dispatchEvent(event);
            });
            return true;
        }

        return false;
    }

    // Try playback immediately or retry shortly after load
    if (!attemptAutoPlay()) {
        let attempts = 0;
        const autoPlayInterval = setInterval(() => {
            attempts++;
            const success = attemptAutoPlay();
            if (success || attempts >= 30) {
                clearInterval(autoPlayInterval);
            }
        }, 150);
    }

    // 3. Stalled Connection Monitor & Auto-Restart
    let connectingTimer = null;
    const CONNECT_TIMEOUT_MS = 5000; // Time in ms to wait before forcing restart

    function triggerFeedRestart() {
        const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        const stopBtn = document.getElementById('lp-stop');

        if (pageWindow.ListenPlayer && typeof pageWindow.ListenPlayer.stop === 'function') {
            try {
                pageWindow.ListenPlayer.stop();
            } catch (e) {}
        } else if (stopBtn) {
            stopBtn.click();
        }

        // Brief delay before calling play again to let the socket/audio element clear
        setTimeout(() => {
            attemptAutoPlay();
        }, 500);
    }

    function checkConnectionState() {
        // Broadcastify popouts typically update an element displaying current playback status
        const statusElem = document.querySelector('.lp-status, #lp-status, .status-text');
        const statusText = statusElem ? statusElem.innerText.toLowerCase() : '';

        if (statusText.includes('connecting')) {
            if (!connectingTimer) {
                connectingTimer = setTimeout(() => {
                    triggerFeedRestart();
                    connectingTimer = null;
                }, CONNECT_TIMEOUT_MS);
            }
        } else {
            if (connectingTimer) {
                clearTimeout(connectingTimer);
                connectingTimer = null;
            }
        }
    }

    // Monitor DOM status text for state changes
    const observer = new MutationObserver(() => {
        checkConnectionState();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // Fallback interval check
    setInterval(checkConnectionState, 1000);
})();