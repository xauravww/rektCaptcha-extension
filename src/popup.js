'use strict';

import './popup.css';

(function () {
  // We will make use of Storage API to get and store `count` value
  // More information on Storage API can we found at
  // https://developer.chrome.com/extensions/storage

  // To get storage access, we have to mention it in `permissions` property of manifest.json file
  // More information on Permissions can we found at
  // https://developer.chrome.com/extensions/declare_permissions

  // Add change listener to settings
  async function handleSettingChange(element) {
    var value = element.classList.contains('settings_toggle')
      ? element.classList.contains('off')
      : parseInt(element.value);

    await chrome.storage.local.set({ [element.dataset.settings]: value });
    if (element.classList.contains('settings_toggle')) {
      element.classList.remove('on', 'off');
      element.classList.add(value ? 'on' : 'off');
    }
  }

  function setupSetting() {
    // Restore settings
    const toggleElements = document.getElementsByClassName('settings_toggle');
    const textElements = document.getElementsByClassName('settings_text');

    chrome.storage.local.get(null, async (e) => {
      let needsUpdate = false;
      const updates = {};
      // Ensure auto toggles are ON by default if undefined
      if (e.recaptcha_auto_open === undefined) {
        updates.recaptcha_auto_open = true;
        needsUpdate = true;
      }
      if (e.recaptcha_auto_solve === undefined) {
        updates.recaptcha_auto_solve = true;
        needsUpdate = true;
      }
      if (needsUpdate) {
        await chrome.storage.local.set(updates);
        // Update local object so UI reflects immediately
        Object.assign(e, updates);
      }
      for (const element of toggleElements) {
        element.classList.remove('on', 'off');
        element.classList.add(e[element.dataset.settings] ? 'on' : 'off');
        element.addEventListener('click', () => handleSettingChange(element));
      }

      for (const element of textElements) {
        element.value = e[element.dataset.settings];
        element.addEventListener('input', () => handleSettingChange(element));
      }
    });
  }

  document.addEventListener('DOMContentLoaded', setupSetting);
})();
