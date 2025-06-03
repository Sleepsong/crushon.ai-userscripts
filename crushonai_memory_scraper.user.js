// ==UserScript==
// @name         Crushon.ai Memory Scraper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Download memory logs from Crushon.ai
// @author       Sleepsong
// @match        *://crushon.ai/memory/*
// @grant        GM_xmlhttpRequest
// @connect      img.cocdn.co
// @connect      cdn.crushon.ai
// @connect      *
// ==/UserScript==

(function () {
    'use strict';

    const BUTTON_ID = 'crushon-download-memory-button';

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
        fullText = fullText.replace(/\\n/g, '\n');
        return fullText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');
    }

    function extractMessages() {
        const messages = [];
        const allDivs = Array.from(document.querySelectorAll('div'));
        for (let i = 0; i < allDivs.length; i++) {
            const div = allDivs[i];
            if (div.classList.contains('double-click-filter') && div.classList.contains('text-right') && div.querySelector('span')) {
                const speaker = div.querySelector('span')?.innerText.trim();
                const msgDiv = allDivs[i + 1]?.querySelector('.MarkdownText_CustomMarkdownText__P3bB6');
                if (speaker && msgDiv) { const messageText = extractFormattedText(msgDiv); if (messageText) { messages.push({ speaker, message: messageText }); }}
            }
            if (div.classList.contains('double-click-filter') && div.querySelector('a') && div.querySelector('a').classList.contains('truncate') && div.querySelector('a span')) {
                const speaker = div.querySelector('a span')?.innerText.trim();
                const msgDiv = div.parentElement?.querySelector('.MarkdownText_CustomMarkdownText__P3bB6');
                if (speaker && msgDiv) { const messageText = extractFormattedText(msgDiv); if (messageText) { if (!messages.find(m => m.message === messageText && m.speaker === speaker)) { messages.push({ speaker, message: messageText }); }}}
            }
        }
        const uniqueMessages = []; const seenKeys = new Set();
        for (const msg of messages) { const key = `${msg.speaker}:${msg.message.substring(0, 100)}`; if (!seenKeys.has(key)) { uniqueMessages.push(msg); seenKeys.add(key); }}
        return uniqueMessages;
    }

    async function fetchImageAsBase64(imageUrl) {
        if (!imageUrl || imageUrl.startsWith('data:image')) { return imageUrl; }
        let baseImageUrl = imageUrl;
        if (imageUrl.startsWith('https://img.cocdn.co/_image/optimize/')) {
            const parts = imageUrl.split('optimize/');
            if (parts.length > 1) { baseImageUrl = parts[1].split('?')[0]; try { if (baseImageUrl.toLowerCase().startsWith('http%3a%2f%2f') || baseImageUrl.toLowerCase().startsWith('https%3a%2f%2f')) { baseImageUrl = decodeURIComponent(baseImageUrl); }} catch (e) { /* ignore */ }}
        }
        const optimizedUrl = `https://img.cocdn.co/_image/optimize/${encodeURIComponent(baseImageUrl)}?q=75&w=384`;
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET", url: optimizedUrl, responseType: "blob",
                onload: function (response) { if (response.status === 200) { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.onerror = () => { resolve(null); }; reader.readAsDataURL(response.response); } else { resolve(null); }},
                onerror: function () { resolve(null); }
            });
        });
    }

    async function getMetadata() {
        const authorEl = document.querySelector('a.truncate.text-xs[href*="/profile/"]');
        const authorName = authorEl?.innerText.trim() || 'Unknown';
        const authorUrl = authorEl ? `https://crushon.ai${authorEl.getAttribute('href')}` : '';

        let character_url = "";
        const characterLinkElement = document.querySelector('a[href*="/character/"][href*="/details"]');
        if (characterLinkElement) {
            const href = characterLinkElement.getAttribute('href');
            if (href) {
                character_url = `https://crushon.ai${href}`;
            }
        }
        if (!character_url) {
            const headerAvatarLink = document.querySelector('div.flex.items-center.justify-center.gap-2 a[href*="/character/"]');
            if (headerAvatarLink) {
                 const href = headerAvatarLink.getAttribute('href');
                 if (href && href.includes('/character/')) { // Ensure it's a character link
                    character_url = `https://crushon.ai${href.endsWith('/details') ? href : href + '/details'}`;
                 }
            }
        }
         if (!character_url) {
            const firstMessageCharLink = document.querySelector('section.w-full a[href*="/character/"]');
             if (firstMessageCharLink) {
                 const href = firstMessageCharLink.getAttribute('href');
                 if (href && href.includes('/character/')) {
                    character_url = `https://crushon.ai${href.endsWith('/details') ? href : href + '/details'}`;
                 }
             }
         }


        const rawAvatarUrl = document.querySelector('a[href*="/details"] img')?.getAttribute('src') ||
                             document.querySelector('div.flex.shrink-0.items-center a[href*="/character/"] img')?.getAttribute('src') ||
                             document.querySelector('div.flex.w-full.items-start a[href*="/character/"] img')?.getAttribute('src') ||
                             document.querySelector('img.size-12')?.getAttribute('src') || '';
        const imageBase64 = await fetchImageAsBase64(rawAvatarUrl);
        const model = getModelFromMemoryPage();
        const tagContainer = document.querySelector('div.flex.flex-wrap.gap-1');
        let tags = [];
        if (tagContainer) { tags = Array.from(tagContainer.querySelectorAll('div > span, a > span')).map(span => span.innerText.trim()).filter(Boolean).filter((tag, index, self) => self.indexOf(tag) === index); }
        if (!tags.length) { const tagSpans = document.querySelectorAll('div.rounded-3xl span, span.box-border span, div[class*="tag"] span'); tags = Array.from(tagSpans).map(span => span.innerText.trim()).filter(Boolean).filter((tag, index, self) => self.indexOf(tag) === index); }

        const titleElement = document.querySelector('h1.line-clamp-2') ||
                                document.querySelector('div.flex.items-center.justify-center.gap-2 > span.truncate:first-of-type') ||
                                document.querySelector('div.flex.items-center.gap-\\[5px\\] a span');
        let title = titleElement ? titleElement.innerText.trim() : 'Unknown Title';

        if ((title === 'Unknown Title' || title.toLowerCase() === 'maxxxiney') && rawAvatarUrl) { // Avoid using user's name as title if possible
             const avatarImg = document.querySelector(`img[src="${rawAvatarUrl}"]`);
             if(avatarImg && avatarImg.alt && !/^(avatar|profile|image)/i.test(avatarImg.alt.trim()) && avatarImg.alt.trim().toLowerCase() !== 'maxxxiney') {
                 title = avatarImg.alt.trim();
             }
        }
        if (title === 'Unknown Title') {
            console.warn("[Memory Scraper] Could not reliably determine title for metadata.");
        }

        return {
            title,
            author: {
                name: authorName,
                url: authorUrl
            },
            character_url: character_url || "",
            image: imageBase64,
            model,
            tags
        };
    }

    function getModelFromMemoryPage() {
        let model = 'Unknown';
        const headerElements = document.querySelectorAll('div.flex.items-center.gap-2');
        headerElements.forEach(el => { const charNameSpan = el.querySelector('span.truncate.font-semibold'); if (charNameSpan) { const modelSpan = el.querySelector('span.text-xs, span[class*="gray"]'); if (modelSpan && modelSpan.innerText.trim().length > 0 && modelSpan.innerText.trim() !== charNameSpan.innerText.trim()) { model = modelSpan.innerText.trim(); if (/\d|\+|claude|gpt|gemini|llama|mistral/i.test(model)) return model;}}});
        if (model !== 'Unknown' && /\d|\+|claude|gpt|gemini|llama|mistral/i.test(model)) return model;
        const labels = Array.from(document.querySelectorAll('span, div')); const modelLabel = labels.find(s => s.innerText.trim().toLowerCase() === 'model:');
        if (modelLabel && modelLabel.nextElementSibling) { model = modelLabel.nextElementSibling.innerText.trim(); if (model) return model;}
        const allBlocks = Array.from(document.querySelectorAll('div.double-click-filter.flex.items-center'));
        for (const block of allBlocks) { const modelSpanCandidate = block.querySelector('span.text-xs.text-gray-1'); if (modelSpanCandidate && modelSpanCandidate.innerText.trim()) { return modelSpanCandidate.innerText.trim(); }}
        return 'Unknown';
    }

    function createDownloadButton() {
        if (document.getElementById(BUTTON_ID)) return;
        const loadMemoryButton = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent?.trim().toLowerCase() === 'load memory');
        const button = document.createElement('button'); button.id = BUTTON_ID; button.textContent = 'Download Memory'; button.style.cursor = 'pointer'; button.style.marginLeft = '10px';
        if (loadMemoryButton && loadMemoryButton.parentElement) {
            const loadStyle = window.getComputedStyle(loadMemoryButton); button.className = loadMemoryButton.className;
            button.style.padding = loadStyle.padding || "10px 20px";
            button.style.backgroundColor = (loadStyle.backgroundColor && loadStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') ? loadStyle.backgroundColor : "#F472B6";
            button.style.color = (loadStyle.color && loadStyle.color !== 'rgba(0, 0, 0, 0)') ? loadStyle.color : "white";
            button.style.border = loadStyle.borderWidth === "0px" ? "none" : loadStyle.border;
            button.style.borderRadius = loadStyle.borderRadius || "9999px";
            button.style.fontSize = loadStyle.fontSize; button.style.fontWeight = loadStyle.fontWeight || "bold";
            button.style.lineHeight = loadStyle.lineHeight; button.style.textAlign = loadStyle.textAlign || "center";
            button.style.display = loadStyle.display || "inline-block";
            loadMemoryButton.parentElement.insertBefore(button, loadMemoryButton.nextSibling);
        } else {
            console.warn("[Memory Scraper] 'Load Memory' button not found. Applying fallback styles.");
            button.style.padding = "10px 20px"; button.style.background = "#4CAF50"; button.style.color = "white"; button.style.border = "none"; button.style.borderRadius = "9999px"; button.style.fontSize = "1em"; button.style.fontWeight = "bold";
            let targetContainer = document.querySelector('div.flex.items-center.justify-between.p-4') ||  document.querySelector('div.flex.justify-end.gap-2') || document.body.firstChild;
            if (targetContainer && targetContainer.appendChild) { targetContainer.appendChild(button); } else { document.body.appendChild(button); }
        }

        button.addEventListener('click', async () => {
            const format = prompt('Download format:\n1 = Plain Text\n2 = JSON', '2');
            if (!format) return;
            const messages = extractMessages();
            if (!messages.length) { alert("No messages found to download."); return; }
            try {
                const metadata = await getMetadata();
                const filenameBase = (metadata.title && metadata.title !== 'Unknown Title' ? metadata.title : 'memory').replace(/[\\/:*?"<>|]/g, '_');

                if (format === '1') {
                    const plainText = messages.map(m => `${m.speaker}:\n${m.message}`).join('\n\n');
                    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `${filenameBase}_log.txt`; a.click(); URL.revokeObjectURL(url);
                } else if (format === '2') {
                    const jsonData = {
                        title: metadata.title, 
                        author: metadata.author,
                        character_url: metadata.character_url,
                        image: metadata.image,
                        model: metadata.model,
                        tags: metadata.tags,
                        messages
                    };
                    const jsonString = JSON.stringify(jsonData, null, 2);
                    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `${filenameBase}_log.json`; a.click(); URL.revokeObjectURL(url);
                } else {
                    alert('Invalid option. Please enter 1 or 2.');
                }
            } catch (error) {
                console.error("[Memory Scraper] Error during download:", error);
                alert("An error occurred during download.");
            }
        });
    }

    const observer = new MutationObserver((mutationsList, observerInstance) => {
        const memoryContentMarker = document.querySelector('div.flex.items-center.justify-start.gap-2 > span.truncate.text-sm.font-semibold.text-white') || document.querySelector('.MarkdownText_CustomMarkdownText__P3bB6');
        if (memoryContentMarker && !document.getElementById(BUTTON_ID)) { createDownloadButton(); }
        else if (!memoryContentMarker && document.getElementById(BUTTON_ID)) { const btn = document.getElementById(BUTTON_ID); if(btn) btn.remove(); }
    });
    let lastMemoryUrl = location.href;
    const memoryUrlObserver = new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastMemoryUrl) {
            lastMemoryUrl = currentUrl; const oldButton = document.getElementById(BUTTON_ID); if (oldButton) oldButton.remove();
            if (currentUrl.includes('/memory/')) { observer.observe(document.body, { childList: true, subtree: true }); }
            else { observer.disconnect(); }
        }
    });
    if (location.href.includes('/memory/')) { observer.observe(document.body, { childList: true, subtree: true }); }
    memoryUrlObserver.observe(document.body, { childList: true, subtree: true });

})();