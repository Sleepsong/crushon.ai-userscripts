# Crushon.ai Userscript Collection

A collection of Tampermonkey userscripts designed to enhance your experience and help manage data on Crushon.ai.

**Disclaimer:** These scripts are provided for personal use. Websites can change their structure at any time, which may break these scripts. Use them responsibly and at your own risk. The generation of Base64 images can result in large JSON files. Use at your own risk in accordance with the Crushon.ai terms of service.

## Prerequisites

To use these scripts, you need a userscript manager browser extension.
* **Tampermonkey** is recommended:
    * [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
    * [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
    * [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
    * [Safari](https://apps.apple.com/app/apple-store/id1482490089?mt=8) (Requires a paid version for Safari)
    * Other browsers may have Tampermonkey or alternative userscript managers (e.g., Greasemonkey for older Firefox versions, Violentmonkey).

## General Installation Instructions

1.  Ensure you have a userscript manager (like Tampermonkey) installed and enabled in your browser.
2.  Click on the "Install Script" link provided for each script below.
3.  Your userscript manager should open a new tab showing the script's source and an "Install" button. Click "Install".
4.  The script will be added to Tampermonkey and will automatically run on the specified Crushon.ai pages.

---

## Scripts Included

### 1. Crushon.ai Chat Scraper

* **Filename on GitHub:** `crushonai_chat_scraper.user.js`
* **Description:** Downloads chat logs from Crushon.ai character chat pages. It can save logs as plain text or JSON. The JSON format includes metadata such as the AI model used, character author details, character image (as a Base64 string), scene image (if available, as Base64), introductory message, and tags. It also attempts to identify speakers in multi-character chats.
* **Latest Version:** 1.0
* **Features:**
    * Downloads chat messages.
    * Option to save as Plain Text (.txt) or JSON (.json).
    * JSON includes:
        * AI Model name.
        * Character URL.
        * Character Image (Base64 encoded, standardized size).
        * Author Name & Profile URL.
        * Scene Image (Base64 encoded, standardized size, if present).
        * Character Intro.
        * Character Tags.
        * Formatted messages with speaker names.
    * Preserves italics from chat messages.
    * Correctly handles newlines based on `<br>` tags and paragraph structure.
    * Button dynamically added to the "More tools" panel in the chat interface.
* **Install:** `[Install Script](https://github.com/Sleepsong/crushon.ai-userscripts/blob/main/crushonai_chat_scraper.user.js)`
* **Usage:**
    1.  Navigate to a Crushon.ai character chat page (e.g., `https://crushon.ai/character/CHARACTER_ID/chat`).
    2.  Open the "three lines" menu (often where "Instruction", "Character Profile", etc. are listed).
    3.  Click the "Download" button added by the script.
    4.  You will be prompted to choose a download format (1 for Plain Text, 2 for JSON).

---

### 2. Crushon.ai Memory Scraper

* **Filename on GitHub:** `crushonai_memory_scraper.user.js`
* **Description:** Downloads chat memories from Crushon.ai memory pages (`/memory/*`). It saves the data as plain text or JSON, including metadata like memory title, author, character avatar (as a Base64 string), character URL, AI model, and tags.
* **Latest Version:** 1.0
* **Features:**
    * Downloads messages from a memory log.
    * Option to save as Plain Text (.txt) or JSON (.json).
    * JSON includes:
        * Memory Title (often the character's name associated with the memory).
        * Author Name & Profile URL.
        * Character URL.
        * Character Avatar (Base64 encoded, standardized size).
        * AI Model used in the memory.
        * Tags associated with the character.
        * Messages with speaker names.
    * Correctly handles various newline representations in memory logs.
    * Button added near the "Load Memory" button on the memory page.
* **Install:** `[Install Script](https://github.com/Sleepsong/crushon.ai-userscripts/blob/main/crushonai_memory_scraper.user.js)`
* **Usage:**
    1.  Navigate to a Crushon.ai memory page (e.g., `https://crushon.ai/memory/MEMORY_ID`).
    2.  Ensure the memory content is loaded.
    3.  Click the "Download Memory" button (styled to match the "Load Memory" button).
    4.  You will be prompted to choose a download format.

---

### 3. Profile Card JSON Downloader

* **Filename on GitHub:** `crushonai_profile_card_scraper.user.js`
* **Description:** Allows you to download character profile card information from your `crushon.ai/account` page or from the character edit screen as a JSON file. The character's photo is included as a Base64 string.
* **Latest Version:** 1.0
* **Features:**
    * Downloads data from individual character cards listed on your `/account` page via a "three dots" menu option.
    * Downloads data from the character creation/edit screen via a button next to the "Save" button.
    * JSON includes:
        * Name
        * Image (Base64 encoded, standardized size, formerly "Character Photo")
        * Gender, Age, Like, Dislike
        * Other Info (Bio from edit screen)
    * Handles image URLs and converts them to Base64.
* **Install:** `[Install Script](https://github.com/Sleepsong/crushon.ai-userscripts/blob/main/crushonai_profile_card_scraper.user.js)`
* **Usage:**
    * **On the character edit screen (Reccomended):**
        1.  Navigate to the screen where you edit a character's details.
        2.  A "Download JSON" button will appear near the site's "Save" button. Click it.
    * **On the `/account` page (listing your characters):**
        1.  Click the "three dots" icon on a character card.
        2.  A menu will appear. Click the "Download JSON" button (with an icon) added by the script.
    * The script will generate and download a JSON file named after the character.

---

## Development Notes

* These scripts rely on the specific HTML structure of Crushon.ai. If the website undergoes significant UI changes, the scripts may need updates to continue functioning correctly.
* Selectors for various elements (buttons, names, messages, metadata) are based on observations at the time of writing and may need adjustments if the site's class names or DOM structure changes.
* The conversion of images to Base64 strings results in larger JSON files compared to storing image URLs. This is by design to have a self-contained data export.
