// ==UserScript==
// @name         Broadcastify Popout Auto-Play & UI Fix
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto-clicks play, handles Linux activation overlay, and customizes UI layout
// @match        *://www.broadcastify.com/listen/feed/popout.php*
// @match        *://broadcastify.com/listen/feed/popout.php*
// @run-at       document-end
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    // 1. Inject custom styles
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
        /* Overlay for Linux activation capture */
        #activation-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 210, 255, 0.05);
            z-index: 999999;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #00d2ff;
            font-family: sans-serif;
            font-size: 13px;
            font-weight: bold;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
        }
    `;

    const styleNode = document.createElement('style');
    styleNode.textContent = customStyles;
    (document.head || document.documentElement).appendChild(styleNode);

    // 2. Playback Kick Logic
    function startPlayback() {
        const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        const playBtn = document.getElementById('lp-play');
        const audio = document.querySelector('audio');

        if (audio) {
            audio.play().catch(() => {});
        }

        if (pageWindow.ListenPlayer && typeof pageWindow.ListenPlayer.play === 'function') {
            try { pageWindow.ListenPlayer.play(); } catch (e) {}
        } else if (playBtn) {
            playBtn.click();
        }
    }

    // 3. Create full-window invisible click catcher
    function setupActivationOverlay() {
        // If already connected successfully, skip overlay
        if (document.querySelector('.lp-status-success')) return;

        const overlay = document.createElement('div');
        overlay.id = 'activation-overlay';
        overlay.innerText = 'Click anywhere to start audio stream';
        
        const handleActivation = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Trigger actual audio play now that we have a real user gesture
            startPlayback();

            // Remove overlay after capturing click
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        };

        overlay.addEventListener('click', handleActivation, { capture: true, once: true });
        overlay.addEventListener('mousedown', handleActivation, { capture: true, once: true });
        
        document.body.appendChild(overlay);
    }

    // Attempt initial auto-play first
    startPlayback();

    // If stream doesn't transition to success within 1 second, display activation overlay
    setTimeout(() => {
        const isSuccess = !!document.querySelector('.lp-status-success');
        if (!isSuccess) {
            setupActivationOverlay();
        }
    }, 1000);

})();