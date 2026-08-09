// ==UserScript==
// @name         Broadcastify Popout Auto-Play & UI Fix
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto-clicks play, monitors success state (.lp-status-success), and customizes UI layout
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
        const audio = document.querySelector('audio');

        // Direct HTML5 Audio playback attempt
        if (audio) {
            audio.play().then(() => {
                console.log('[Userscript] Audio playing via HTML5 element.');
            }).catch(() => {});
        }

        // Broadcastify API call
        if (pageWindow.ListenPlayer && typeof pageWindow.ListenPlayer.play === 'function') {
            try {
                pageWindow.ListenPlayer.play();
                return true;
            } catch (e) {}
        }

        // DOM Fallback: Mouse event dispatch
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

    // Initial load attempts
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

    // 3. Success-State Monitor (.lp-status-success Verification)
    let connectionCheckTimer = null;
    const SUCCESS_TIMEOUT_MS = 2500; // Time allowed to achieve .lp-status-success before cycling

    function forceStreamReset() {
        console.log('[Userscript] Target .lp-status-success not detected in time. Force-cycling connection...');
        const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        const stopBtn = document.getElementById('lp-stop');
        const audio = document.querySelector('audio');

        // 1. Stop playback via API or DOM
        if (pageWindow.ListenPlayer && typeof pageWindow.ListenPlayer.stop === 'function') {
            try { pageWindow.ListenPlayer.stop(); } catch (e) {}
        } else if (stopBtn) {
            stopBtn.click();
        }

        // 2. Clear HTML5 Audio element buffer and socket connection
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.load();
        }

        // 3. Re-trigger play attempt
        setTimeout(() => {
            attemptAutoPlay();
        }, 400);
    }

    function verifySuccessState() {
        const audio = document.querySelector('audio');
        
        // Check for success elements or active audio playback state
        const isSuccessClassPresent = !!document.querySelector('.lp-status-success');
        const isStatusBarSuccess = !!document.querySelector('.lp-status-bar.lp-status-success');
        const isAudioPlaying = audio && !audio.paused && audio.currentTime > 0 && audio.readyState >= 3;

        const isConnectedAndPlaying = isSuccessClassPresent || isStatusBarSuccess || isAudioPlaying;

        if (!isConnectedAndPlaying) {
            // Not connected successfully yet; start or keep timer running
            if (!connectionCheckTimer) {
                connectionCheckTimer = setTimeout(() => {
                    forceStreamReset();
                    connectionCheckTimer = null;
                }, SUCCESS_TIMEOUT_MS);
            }
        } else {
            // Confirmed successful connection! Clear timer.
            if (connectionCheckTimer) {
                clearTimeout(connectionCheckTimer);
                connectionCheckTimer = null;
                console.log('[Userscript] Connection verified via .lp-status-success / audio playback.');
            }
        }
    }

    // Observe changes to classes or elements inside the status bar
    const observer = new MutationObserver(() => {
        verifySuccessState();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
    });

    // Fallback interval verification
    setInterval(verifySuccessState, 600);

    // 4. One-click gesture unblock for Linux browsers
    window.addEventListener('click', () => {
        const audio = document.querySelector('audio');
        if (audio && audio.paused) {
            audio.play().catch(() => {});
        }
    }, { once: true });

})();