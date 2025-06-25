// ==UserScript==
// @name         Crushon.ai Chat Scraper
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  Download chat logs from Crushon.ai
// @author       Sleepsong
// @match        *://crushon.ai/character/*/chat*
// @grant        GM_xmlhttpRequest
// @connect      img.cocdn.co
// @connect      *.wsrv.nl
// @connect      *
// ==/UserScript==

(function () {
    'use strict';

    const BUTTON_ID = 'crushon-download-chat-button';

    // getCharacterNameFallback from v2.10.6
    function getCharacterNameFallback() {
        let name = 'UnknownCharacter';
        const allMessageBlocks = Array.from(document.querySelectorAll('div[data-id]'));
        for (const block of allMessageBlocks) {
            const isLikelyAIMessage = block.querySelector('button span');
            const speakerElement = block.querySelector('div.flex.items-center.gap-\\[5px\\] span');
            let potentialNameFromMessage = '';
            if (speakerElement && speakerElement.innerText.trim()) {
                potentialNameFromMessage = speakerElement.innerText.trim();
            }
            if (isLikelyAIMessage && potentialNameFromMessage && potentialNameFromMessage.toLowerCase() !== 'user' && potentialNameFromMessage.toLowerCase() !== 'you') {
                name = potentialNameFromMessage; return name;
            }
        }
        const headerNameSelectors = [
            'div[class*="ChatRoom_characterName"]', 'div[class*="chat-header"] span[class*="name"]',
            'svg[xmlns$="http://www.w3.org/2000/svg"] + span.truncate',
            'a[href*="/character/"][class*="profile-link"] span.truncate',
            'div[class*="sticky"] span.truncate.text-lg', 'h1[class*="character-title"]',
        ];
        for (const selector of headerNameSelectors) {
            const nameElement = document.querySelector(selector);
            if (nameElement && nameElement.innerText.trim()) {
                const potentialName = nameElement.innerText.trim();
                if (potentialName.toLowerCase() !== 'user' && potentialName.toLowerCase() !== 'you') {
                    if (nameElement.closest('div[data-id]') && selector === 'svg[xmlns$="http://www.w3.org/2000/svg"] + span.truncate') { continue; }
                    name = potentialName; return name;
                }
            }
        }
        const detailsLinkAnchor = document.querySelector('a[href*="/details"]');
        if (detailsLinkAnchor) {
            const nameSpanInDetails = detailsLinkAnchor.querySelector('span.font-semibold, span.truncate');
            if (nameSpanInDetails && nameSpanInDetails.innerText.trim()) {
                const potentialName = nameSpanInDetails.innerText.trim();
                 if (potentialName.toLowerCase() !== 'user' && potentialName.toLowerCase() !== 'you' && !/details/i.test(potentialName)) {
                    name = potentialName; return name;
                }
            }
            const imgInDetails = detailsLinkAnchor.querySelector('img');
            if (imgInDetails && imgInDetails.alt && !/^(avatar|profile|image)/i.test(imgInDetails.alt.trim())) {
                name = imgInDetails.alt.trim(); return name;
            }
        }
        if (name === 'UnknownCharacter') console.warn('[CS] Could not reliably determine main character name for filename.');
        return name;
    }

    function getSecondCharacterName(mainAiName) {
        // ... (from v2.10.7 - unchanged)
        const simpleHeaderSpan = document.querySelector('svg[xmlns$="http://www.w3.org/2000/svg"] + span.truncate');
        if (simpleHeaderSpan) {
            const potentialName = simpleHeaderSpan.innerText.trim();
            if (potentialName && potentialName !== mainAiName && potentialName.toLowerCase() !== 'user' && potentialName.toLowerCase() !== 'you') {
                if (!simpleHeaderSpan.closest('div[data-id]') || potentialName !== mainAiName) { return potentialName; }
            }
        }
        const allExplicitSpeakerElements = document.querySelectorAll('div[data-id] div.flex.items-center.gap-\\[5px\\] span');
        for (const el of allExplicitSpeakerElements) {
            const name = el.innerText.trim();
            if (name && name !== mainAiName && name.toLowerCase() !== 'user' && name.toLowerCase() !== 'you') { return name; }
        }
        return "OtherCharacter";
    }

    // "Perfect" extractFormattedText from v2.10.6
    function extractFormattedText(htmlElement) {
        if (!htmlElement) return '';
        const clone = htmlElement.cloneNode(true);
        clone.querySelectorAll('br').forEach(br => {
            br.replaceWith(document.createTextNode('\n'));
        });
        clone.querySelectorAll('em, i').forEach(el => {
            const content = el.textContent.trim();
            if (content) {
                const before = document.createTextNode('\n');
                const after = document.createTextNode('\n');
                const wrapped = document.createTextNode(`*${content}*`);
                el.replaceWith(before, wrapped, after);
            } else {
                el.remove();
            }
        });
        clone.querySelectorAll('p').forEach(p => {
            const textContentVal = p.textContent.trim();
            p.replaceWith(document.createTextNode(textContentVal + (textContentVal.length > 0 ? ' ' : '')));
        });
        let fullText = clone.textContent || "";
        return fullText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');
    }

    async function fetchImageAsBase64(imageUrl) { /* ...from v2.10.7, unchanged... */
        if (!imageUrl || imageUrl.startsWith('data:image')) return imageUrl;
        let optimizedUrl = imageUrl;
        if (imageUrl.includes('cdn.crushon.ai') && !imageUrl.startsWith('https://img.cocdn.co/_image/optimize/')) {
            optimizedUrl = `https://img.cocdn.co/_image/optimize/${encodeURIComponent(imageUrl)}?q=75&w=384`;
        }
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET", url: optimizedUrl, responseType: "blob",
                onload: (r) => { if (r.status === 200) { const f = new FileReader(); f.onloadend = () => resolve(f.result); f.onerror = (e) => {console.error(e);resolve(null);}; f.readAsDataURL(r.response); } else { console.error(r.status); resolve(null);}},
                onerror: (e) => { console.error(e); resolve(null);}
            });
        });
    }

    async function getChatMetadata() { /* ...from v2.10.7, unchanged... */
        const messageBlocks = Array.from(document.querySelectorAll('div[data-id]'));
        let model = 'Unknown';
        for (const block of messageBlocks) {const modelSpan = block.querySelector('button span'); if (modelSpan && modelSpan.innerText.trim()) { model = modelSpan.innerText.trim(); break; }}
        const characterDetailsAnchor = document.querySelector('a[href*="/character/"][href*="/details"]');
        let character_url = ""; let originalImageUrl = "";
        if (characterDetailsAnchor) { const href = characterDetailsAnchor.getAttribute('href'); if (href) { character_url = `https://crushon.ai${href}`; } const imgElement = characterDetailsAnchor.querySelector('img'); if (imgElement) { originalImageUrl = imgElement.getAttribute('src') || ''; }}
        else { const genericImg = document.querySelector('div[class*="avatar"] img, img[alt*="avatar"]'); if (genericImg) { originalImageUrl = genericImg.getAttribute('src') || ''; } console.warn("[Chat Scraper] Could not find primary character details link for character_url. URL might be missing.");}
        if (originalImageUrl.includes('optimize/https://')) { originalImageUrl = originalImageUrl.split('optimize/')[1].split('?')[0]; }
        const imageBase64 = await fetchImageAsBase64(originalImageUrl);
        const authorLink = document.querySelector('a[href^="/profile/"]'); const authorName = authorLink?.innerText.trim() || 'Unknown';
        const authorUrl = authorLink ? `https://crushon.ai${authorLink.getAttribute('href')}` : ''; let sceneBase64 = null;
        const sceneContainer = document.querySelector('div.absolute.inset-0.-z-10.size-full');
        if (sceneContainer) { const imgs = sceneContainer.querySelectorAll('img'); if (imgs.length > 1 && imgs[1]?.getAttribute('src')) { sceneBase64 = await fetchImageAsBase64(imgs[1].getAttribute('src')); } else if (imgs.length > 0 && imgs[0]?.getAttribute('src')) { sceneBase64 = await fetchImageAsBase64(imgs[0].getAttribute('src')); }}
        let intro = null; const introSection = Array.from(document.querySelectorAll('span')).find(s => s.textContent.trim()==='Intro')?.closest('div')?.parentElement?.parentElement;
        if (introSection) { const introText = introSection.querySelector('.rich-html')?.textContent?.trim(); if (introText) intro = introText; }
        let tags = []; const tagContainer = document.querySelector('div.flex.flex-wrap.gap-1');
        if (tagContainer) { tags = Array.from(tagContainer.querySelectorAll('div > span, a > span')).map(el => el.textContent.trim()).filter(Boolean).filter((tag, index, self) => self.indexOf(tag) === index); }
        return { model, character_url: character_url || "", imageBase64, authorName, authorUrl, sceneBase64, intro, tags };
    }

    // Reworked createDownloadButton for the new menu structure
    function createDownloadButton() {
        if (document.getElementById(BUTTON_ID)) return;

        // Create the button by cloning a native menu item structure
        const nativeMenuItem = document.querySelector('div[class*="dark:bg-black-7"] > div.flex.w-full.cursor-pointer');
        if (!nativeMenuItem) return; // Can't find a native item to clone

        const button = nativeMenuItem.cloneNode(true); // Clone the structure of "Max", "Scene", etc.
        button.id = BUTTON_ID;

        // Change the icon to a download icon
        const svgElement = button.querySelector('svg');
        if (svgElement) {
            svgElement.setAttribute('viewBox', '0 0 24 24');
            svgElement.innerHTML = `<path d="M5 20h14v-2H5v2zm7-18L5.33 9h3.67v6h4V9h3.67L12 2z" fill="currentColor"/>`;
        }

        // Change the text label
        const textElement = button.querySelector('div.truncate');
        if (textElement) {
            textElement.textContent = 'Download';
        }

        button.addEventListener('click', async () => {
            const format = prompt('Download format:\n1 = Plain Text\n2 = JSON', '1');
            if (!format) return;

            const mainAiNameForFile = getCharacterNameFallback().replace(/[\\/:*?"<>|]/g, '_') || 'Chat';
            const secondCharacterName = getSecondCharacterName(mainAiNameForFile);

            const messages = Array.from(document.querySelectorAll('.MarkdownText_CustomMarkdownText__P3bB6')).map(msg => {
                const text = extractFormattedText(msg);
                let speaker = 'Unknown';
                const messageBlock = msg.closest('div[data-id]');
                if (messageBlock) {
                    const explicitSpeakerElement = messageBlock.querySelector('div.flex.items-center.gap-\\[5px\\] span');
                    if (explicitSpeakerElement && explicitSpeakerElement.innerText.trim()) {
                        speaker = explicitSpeakerElement.innerText.trim();
                        if (speaker.toLowerCase() === 'user' || speaker.toLowerCase() === 'you') { speaker = 'User';}
                    } else {
                        const hasModelButton = messageBlock.querySelector('button span');
                        if (hasModelButton) { speaker = mainAiNameForFile; } else { speaker = secondCharacterName; }
                    }
                }
                return { speaker, message: text };
            });

            if (format === '1') {
                const plainText = messages.map(m => `${m.speaker}:\n${m.message}`).join('\n\n');
                const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${mainAiNameForFile}_chat_log.txt`; a.click(); URL.revokeObjectURL(url);
            } else if (format === '2') {
                try {
                    const metadata = await getChatMetadata();
                    const jsonOutput = { model: metadata.model, character_url: metadata.character_url, image: metadata.imageBase64, author: { name: metadata.authorName, url: metadata.authorUrl }, ...(metadata.sceneBase64 ? { sceneImage: metadata.sceneBase64 } : {}), ...(metadata.intro ? { intro: metadata.intro } : {}), ...(metadata.tags?.length ? { tags: metadata.tags } : {}), messages };
                    const jsonString = JSON.stringify(jsonOutput, null, 2); const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `${mainAiNameForFile}_chat_log.json`; a.click(); URL.revokeObjectURL(url);
                } catch (error) { console.error('[Chat Scraper] Error generating JSON:', error); alert('Error generating JSON.');}
            } else { alert('Invalid option.'); }
        });

        // Use a MutationObserver to find the new menu container and append the button.
        const menuObserver = new MutationObserver(() => {
            // Selector for the new menu container based on your HTML
            const menuContainer = document.querySelector('div[class*="dark:bg-black-7"][class*="rounded-[14px]"]');

            if (menuContainer && !menuContainer.querySelector(`#${BUTTON_ID}`)) {
                menuContainer.appendChild(button);
                // console.log('[Chat Scraper] Download button added to new menu.');
            }
        });
        menuObserver.observe(document.body, { childList: true, subtree: true });

        // This function will now use the observer above to add the button.
        // The old logic for finding the "Instruction" panel is no longer needed here.
    }


    function observeUntilReady() {
        // This observer just waits for the chat to be ready, then calls createDownloadButton
        // createDownloadButton now sets up its own observer to find the new menu
        const readyObserver = new MutationObserver((mutations, obs) => {
            const container = document.querySelector('#chat-container') || document.querySelector('div[class*="ChatRoom_chatPanel"]');
            const messagesExist = document.querySelector('.MarkdownText_CustomMarkdownText__P3bB6');
            if (container && messagesExist) {
                createDownloadButton();
                obs.disconnect();
            }
        });
        readyObserver.observe(document.body, { childList: true, subtree: true });
    }

    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            const oldButton = document.getElementById(BUTTON_ID);
            if (oldButton) oldButton.remove();
            if (window.location.pathname.includes("/chat")) {
                 observeUntilReady();
            }
        }
    });
    urlObserver.observe(document.body, { childList: true, subtree: true });

    if (window.location.pathname.includes("/chat")) {
        if (document.readyState === 'complete') setTimeout(observeUntilReady, 500);
        else window.addEventListener('load', () => { observeUntilReady(); });
    }
})();
