// ==UserScript==
// @name         Crushon.ai Profile Card Scraper
// @author       Sleepsong
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Download profile card or edit screen data as JSON from Crushon.ai
// @match        *://crushon.ai/account
// @grant        GM_xmlhttpRequest
// @connect      img.cocdn.co
// @connect      cdn.crushon.ai
// @connect      *
// ==/UserScript==

(function () {
    'use strict';

    let lastClickedCard = null;

    async function fetchImageAsBase64(imageUrl) {
        if (!imageUrl || imageUrl.startsWith('data:image')) { return imageUrl; }
        let baseImageUrl = imageUrl;
        if (imageUrl.startsWith('https://img.cocdn.co/_image/optimize/')) {
            const parts = imageUrl.split('optimize/');
            if (parts.length > 1) {
                baseImageUrl = parts[1].split('?')[0];
                try { if (baseImageUrl.toLowerCase().startsWith('http%3a%2f%2f') || baseImageUrl.toLowerCase().startsWith('https%3a%2f%2f')) { baseImageUrl = decodeURIComponent(baseImageUrl); }} catch (e) { console.warn("[PD] Error decoding baseImageUrl:", e); }
            }
        } else if (imageUrl.includes('cdn.crushon.ai') && imageUrl.includes('?')) { baseImageUrl = imageUrl.split('?')[0]; }
        const optimizedUrl = `https://img.cocdn.co/_image/optimize/${encodeURIComponent(baseImageUrl)}?q=75&w=384`;
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET", url: optimizedUrl, responseType: "blob",
                onload: function (response) {
                    if (response.status === 200) { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.onerror = (error) => { console.error('[PD] FileReader error:', error); resolve(imageUrl); }; reader.readAsDataURL(response.response); }
                    else { console.error(`[PD] Img fetch error ${response.status}: ${optimizedUrl}`); resolve(imageUrl); }
                },
                onerror: (error) => { console.error(`[PD] GM_xhr error for ${optimizedUrl}:`, error); resolve(imageUrl); }
            });
        });
    }

    function createStyledDownloadButton(callback, label = "Download JSON") {
        const btn = document.createElement("button");
        btn.className = "group profile-card-download-button download-button w-full";

        btn.style.width = "100%";
        btn.style.background = "transparent";
        btn.style.border = "none";
        btn.style.padding = "0";      
        btn.style.margin = "0";
        btn.style.cursor = "pointer";
        btn.style.fontFamily = "inherit";
        btn.style.outline = "none";
        btn.style.textAlign = "left";

        const innerSpan = document.createElement('span');
        innerSpan.style.display = 'flex';
        innerSpan.style.alignItems = 'center';
        innerSpan.style.width = '100%';
        innerSpan.style.padding = '0'; 
        innerSpan.style.boxSizing = 'border-box';
        innerSpan.style.color = '#E0E0E0';
        innerSpan.style.fontSize = '0.75rem';
        innerSpan.style.fontWeight = '500';
        innerSpan.classList.add("dark:text-gray-100");

        const iconElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        iconElement.setAttribute("viewBox", "0 0 16 16");
        iconElement.setAttribute("fill", "currentColor");
        iconElement.classList.add("h-4", "w-4", "shrink-0");
        iconElement.style.marginRight = "0.5rem";
        iconElement.innerHTML = `<path d="M4.53 11.03a.75.75 0 001.06 1.06l1.72-1.72v3.44a.75.75 0 001.5 0V10.36l1.72 1.72a.75.75 0 101.06-1.06l-3-3a.75.75 0 00-1.06 0l-3 3zM3.25 5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 013.25 5z"/>`;

        const labelSpan = document.createElement('span');
        labelSpan.className = "truncate";
        labelSpan.textContent = label;

        innerSpan.appendChild(iconElement);
        innerSpan.appendChild(labelSpan);
        btn.appendChild(innerSpan);

        btn.onmouseenter = () => { innerSpan.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; };
        btn.onmouseleave = () => { innerSpan.style.backgroundColor = 'transparent'; };

        btn.onclick = callback;
        return btn;
    }

    function createEditScreenDownloadButton(callback, label = "Download JSON") {
        const btn = document.createElement("button"); btn.textContent = label; btn.className = "edit-screen-download-button download-button";
        btn.style.margin = "0px"; btn.style.padding = "10px 20px"; btn.style.marginTop = "10px"; btn.style.background = "#ff67e0"; btn.style.color = "white"; btn.style.border = "none";
        btn.style.borderRadius = "9999px"; btn.style.cursor = "pointer"; btn.style.width = "100%"; btn.style.fontSize = "14px"; btn.style.fontWeight = "bold";
        btn.onclick = callback; return btn;
    }

    function downloadJSON(data, filename = "profile.json") {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    }

    async function extractProfileCardData(card) {
        const getValue = (label) => { const container = Array.from(card.querySelectorAll("span.flex.gap-1")).find(span => span.textContent.trim().startsWith(label)); return container?.querySelectorAll("span")[1]?.textContent.trim() || ""; };
        const name = card.querySelector("span.font-bold")?.textContent.trim() || "UnknownProfile"; const imageUrl = card.querySelector("img")?.src || "";
        const imageBase64 = await fetchImageAsBase64(imageUrl);
        return { Name: name, image: imageBase64 || "", Gender: getValue("Gender:"), Age: getValue("Age:"), Like: getValue("like:"), Dislike: getValue("Dislike:"), "Other Info": "" };
    }

    async function extractEditScreenData() {
        const name = document.querySelector("input[name='name']")?.value || "UnknownProfile"; const imageUrl = document.querySelector("img[alt='avatar']")?.src || "";
        const imageBase64 = await fetchImageAsBase64(imageUrl); let gender = ""; const checkedGenderRadio = document.querySelector("input[name='gender']:checked");
        if (checkedGenderRadio) { let genderLabelElement = checkedGenderRadio.nextElementSibling; if (!genderLabelElement || (genderLabelElement.tagName !== 'SPAN' && genderLabelElement.tagName !== 'LABEL')) { const radioId = checkedGenderRadio.id; if (radioId) { genderLabelElement = document.querySelector(`label[for='${radioId}'] span`) || document.querySelector(`label[for='${radioId}']`); }} gender = genderLabelElement?.textContent.trim() || "";}
        return { Name: name, image: imageBase64 || "", Gender: gender, Age: document.querySelector("input[name='age']")?.value || "", Like: document.querySelector("input[name='like']")?.value || "", Dislike: document.querySelector("input[name='dislike']")?.value || "", "Other Info": document.querySelector("textarea[name='bio']")?.value || "" };
    }

    document.addEventListener("click", (event) => {
        const icon = event.target.closest("button[aria-label='More options'], .absolute.end-1.top-1.cursor-pointer, [data-testid='character-card-options-button']");
        if (icon) {
            lastClickedCard = icon.closest("div[role='listitem'], div[class*='card'], div[class*='item'], .rounded-lg.bg-purple-3, [data-testid^='character-card-']");
        }
    });

    const menuObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType !== 1) return; let menuElement = null;
                if (node.matches('div[role="menu"], ul[role="menu"], div[class*="menu-popup"], div[class*="dropdown-menu"]') || node.querySelector('div[role="menu"], ul[role="menu"], div[class*="menu-popup"], div[class*="dropdown-menu"]')) { menuElement = node.matches('div[role="menu"], ul[role="menu"], div[class*="menu-popup"], div[class*="dropdown-menu"]') ? node : node.querySelector('div[role="menu"], ul[role="menu"], div[class*="menu-popup"], div[class*="dropdown-menu"]');}
                if (!menuElement && node.children.length > 1) { const firstChild = node.children[0]; if (firstChild && (firstChild.tagName === 'BUTTON' || (firstChild.tagName === 'DIV' && firstChild.querySelector('svg')))) { const style = window.getComputedStyle(node); if (style.position === 'absolute' || style.position === 'fixed') { menuElement = node; }}}
                if (menuElement && !menuElement.querySelector(".profile-card-download-button")) {
                    const downloadBtn = createStyledDownloadButton(async () => { if (lastClickedCard) { try { const data = await extractProfileCardData(lastClickedCard); downloadJSON(data, `${data.Name.replace(/[\\/:*?"<>|]/g, '_') || "profile"}.json`); } catch (e) { console.error("[PD] Error processing profile card data:", e); alert("Error processing profile card data.");}} else { console.warn("[PD] Download clicked but lastClickedCard is not set."); alert("Could not find the profile card data. Please click the 'three dots' icon on a card again before clicking download.");}});
                    const menuItemContainer = menuElement.querySelector('div[role="none"]') || menuElement.querySelector('ul') || menuElement;
                    menuItemContainer.appendChild(downloadBtn);
                }
            });
        });
    });
    menuObserver.observe(document.body, { childList: true, subtree: true });

    const editObserver = new MutationObserver(() => {
        const saveBtn = Array.from(document.querySelectorAll("button")).find(btn => btn.textContent?.trim().toLowerCase() === "save");
        if (saveBtn && saveBtn.parentElement && !saveBtn.parentElement.querySelector(".edit-screen-download-button")) {
            const downloadBtn = createEditScreenDownloadButton(async () => { try { const data = await extractEditScreenData(); downloadJSON(data, `${data.Name.replace(/[\\/:*?"<>|]/g, '_') || "profile_edit"}.json`); } catch (e) { console.error("Error processing edit screen data:", e); alert("Error processing edit screen.");}});
            saveBtn.parentElement.insertBefore(downloadBtn, saveBtn.nextSibling);
        }
    });
    editObserver.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
        const saveBtn = Array.from(document.querySelectorAll("button")).find(btn => btn.textContent?.trim().toLowerCase() === "save");
         if (saveBtn && saveBtn.parentElement && !saveBtn.parentElement.querySelector(".edit-screen-download-button")) {
            editObserver.disconnect();
            const downloadBtn = createEditScreenDownloadButton(async () => { try { const data = await extractEditScreenData(); downloadJSON(data, `${data.Name.replace(/[\\/:*?"<>|]/g, '_') || "profile_edit"}.json`);} catch (e) {console.error(e); alert("Error.");}});
            saveBtn.parentElement.insertBefore(downloadBtn, saveBtn.nextSibling);
            editObserver.observe(document.body, { childList: true, subtree: true });
        }
    }, 1500);

})();