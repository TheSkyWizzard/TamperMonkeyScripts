// ==UserScript==
// @name         Broadcastify Popout Auto-Play & UI Fix
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto-clicks play, monitors stuck connection states (.lp-state-connecting), and customizes UI layout
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

    // 2. Direct Auto-play Execution & HTML5 Kick
    function attemptAutoPlay() {
        const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        const playBtn = document.getElementById('lp-play');
        const audio = document.querySelector('audio');

        // Direct HTML5 Audio playback attempt
        if (audio) {
            audio.play().then(() => {
                console.log('[Userscript] Audio stream playing via HTML5 element.');
            }).catch(() => {
                // Autoplay blocked by browser policy; will be kicked on first click
            });
        }

        // Check if Broadcastify's JavaScript API is accessible
        if (pageWindow.ListenPlayer && typeof pageWindow.ListenPlayer.play === 'function') {
            try {
                pageWindow.ListenPlayer.play();
                return true;
            } catch (e) {
                // Fallback to DOM manipulation if API call fails
            }
        }

        // DOM Fallback: Trigger standard mouse events on play button
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

    // 3. Stalled Connection Monitor & Auto-Restart (.lp-state-connecting)
    let connectingTimer = null;
    const CONNECT_TIMEOUT_MS = 2500; // Time in ms before forcing a cycle when connecting state is present

    function triggerFeedRestart() {
        console.log('[Userscript] .lp-state-connecting persistent state detected. Forcing stream reload...');
        const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        const stopBtn = document.getElementById('lp-stop');
        const audio = document.querySelector('audio');

        // 1. Force Stop via API or DOM
        if (pageWindow.ListenPlayer && typeof pageWindow.ListenPlayer.stop === 'function') {
            try { pageWindow.ListenPlayer.stop(); } catch (e) {}
        } else if (stopBtn) {
            stopBtn.click();
        }

        // 2. Reset underlying HTML5 Audio element socket
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.load();
        }

        // 3. Re-trigger Play
        setTimeout(() => {
            attemptAutoPlay();
        }, 350);
    }

    function checkConnectionState() {
        const statusElem = document.querySelector('.lp-status, #lp-status, .status-text');
        const playBtn = document.getElementById('lp-play');
        const audio = document.querySelector('audio');

        // Check for .lp-state-connecting explicitly anywhere in the DOM
        const isConnectingClassPresent = !!document.querySelector('.lp-state-connecting');
        
        const statusText = statusElem ? statusElem.innerText.toLowerCase() : '';
        const isSpinnerActive = playBtn && (playBtn.classList.contains('loading') || playBtn.classList.contains('fa-spin') || playBtn.classList.contains('is-loading'));
        const isAudioStalled = audio && (audio.networkState === 2 && audio.readyState < 3 && !audio.paused);

        // If .lp-state-connecting exists or secondary indicators trigger:
        if (isConnectingClassPresent || statusText.includes('connecting') || isSpinnerActive || isAudioStalled) {
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

    // Monitor DOM mutations for class additions/removals like .lp-state-connecting
    const observer = new MutationObserver(() => {
        checkConnectionState();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'style']
    });

    // Fallback interval check
    setInterval(checkConnectionState, 800);

    // 4. One-click fallback gesture kick for Linux browsers
    window.addEventListener('click', () => {
        const audio = document.querySelector('audio');
        if (audio && audio.paused) {
            audio.play().catch(() => {});
        }
    }, { once: true });

})();