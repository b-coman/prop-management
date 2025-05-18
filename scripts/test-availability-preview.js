/**
 * Test script for the Availability Preview feature
 * 
 * This script provides functions to test the new availability preview
 * functionality, including opening the dialog and testing date selection.
 * 
 * Usage:
 * 1. Navigate to a property page in your browser
 * 2. Open the browser console (F12 or right-click > Inspect > Console)
 * 3. Paste this entire script and press Enter
 * 4. Call the test functions as needed
 */

(async function() {
  console.log('🔍 Initializing Availability Preview test script...');
  
  // Create a test logger
  const log = (message, type = 'info') => {
    const styles = {
      info: 'color: #3b82f6; font-weight: bold;',
      success: 'color: #10b981; font-weight: bold;',
      error: 'color: #ef4444; font-weight: bold;',
      warning: 'color: #f59e0b; font-weight: bold;'
    };
    console.log(`%c[Preview Test] ${message}`, styles[type] || styles.info);
  };
  
  // Wait for element function
  const waitForElement = (selector, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }
      
      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  };
  
  // Test function to open the preview dialog
  window.testOpenPreviewDialog = async () => {
    try {
      log('Looking for the preview dialog button...');
      
      // Try to find the preview button
      const previewButton = await waitForElement('button:has(.h-3\\.5.w-3\\.5)');
      
      if (!previewButton) {
        log('Preview button not found', 'error');
        return;
      }
      
      log('Found preview button, clicking...', 'success');
      previewButton.click();
      
      // Wait for dialog to open
      const dialog = await waitForElement('[role="dialog"]');
      
      if (!dialog) {
        log('Dialog did not open after clicking the button', 'error');
        return;
      }
      
      log('Dialog opened successfully', 'success');
      return true;
    } catch (error) {
      log(`Error opening preview dialog: ${error.message}`, 'error');
      return false;
    }
  };
  
  // Test function to select dates in the preview dialog
  window.testSelectDatesInPreview = async () => {
    try {
      // First make sure dialog is open
      if (!document.querySelector('[role="dialog"]')) {
        await window.testOpenPreviewDialog();
      }
      
      log('Looking for date picker in preview dialog...');
      
      // Find date picker trigger
      const dateTrigger = await waitForElement('[role="dialog"] button:has(.lucide-calendar)');
      
      if (!dateTrigger) {
        log('Date picker trigger not found', 'error');
        return;
      }
      
      log('Found date picker, clicking to open...', 'success');
      dateTrigger.click();
      
      // Wait for date picker to open
      const calendar = await waitForElement('.rdp');
      
      if (!calendar) {
        log('Calendar did not open', 'error');
        return;
      }
      
      log('Calendar opened, selecting dates...', 'success');
      
      // Select tomorrow as check-in
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      
      // Find dates that are not disabled
      const availableDays = Array.from(document.querySelectorAll('.rdp-day'))
        .filter(day => !day.classList.contains('rdp-day_disabled'));
      
      if (availableDays.length < 2) {
        log('Not enough available days to select a range', 'warning');
        return;
      }
      
      log(`Found ${availableDays.length} available days, selecting first two...`, 'success');
      
      // Click the first available day (start date)
      availableDays[0].click();
      
      // Wait a moment and click the second available day (end date)
      setTimeout(() => {
        availableDays[1].click();
        log('Date range selected', 'success');
        
        // Now try to save this range
        setTimeout(async () => {
          const saveButton = await waitForElement('[role="dialog"] button:contains("Save This Date Range")');
          if (saveButton) {
            saveButton.click();
            log('Saved date range to the list', 'success');
          } else {
            log('Save button not found', 'error');
          }
        }, 500);
      }, 500);
      
      return true;
    } catch (error) {
      log(`Error selecting dates: ${error.message}`, 'error');
      return false;
    }
  };
  
  // Test to check saved ranges tab
  window.testSavedRangesTab = async () => {
    try {
      // First make sure dialog is open
      if (!document.querySelector('[role="dialog"]')) {
        await window.testOpenPreviewDialog();
      }
      
      log('Looking for saved ranges tab...');
      
      // Find the saved ranges tab
      const savedRangesTab = await waitForElement('[role="dialog"] [data-value="saved-ranges"]');
      
      if (!savedRangesTab) {
        log('Saved ranges tab not found', 'error');
        return;
      }
      
      log('Found saved ranges tab, clicking...', 'success');
      savedRangesTab.click();
      
      // Wait for tab content to activate
      setTimeout(() => {
        const rangesList = document.querySelectorAll('[role="dialog"] [data-value="saved-ranges"][data-state="active"] > div > div');
        
        if (rangesList && rangesList.length > 0) {
          log(`Found ${rangesList.length} saved date ranges`, 'success');
        } else {
          log('No saved date ranges found, or tab content not visible', 'warning');
        }
      }, 500);
      
      return true;
    } catch (error) {
      log(`Error checking saved ranges tab: ${error.message}`, 'error');
      return false;
    }
  };
  
  // Full end-to-end test
  window.testAvailabilityPreviewFeature = async () => {
    try {
      log('Starting full end-to-end test of availability preview feature...', 'info');
      
      // Step 1: Open dialog
      const dialogOpened = await window.testOpenPreviewDialog();
      
      if (!dialogOpened) {
        log('Failed at step 1: Opening dialog', 'error');
        return;
      }
      
      log('Step 1 passed: Dialog opened successfully', 'success');
      
      // Step 2: Select dates
      const datesSelected = await window.testSelectDatesInPreview();
      
      if (!datesSelected) {
        log('Failed at step 2: Selecting dates', 'error');
        return;
      }
      
      log('Step 2 passed: Dates selected successfully', 'success');
      
      // Step 3: Check saved ranges tab
      setTimeout(async () => {
        const tabChecked = await window.testSavedRangesTab();
        
        if (!tabChecked) {
          log('Failed at step 3: Checking saved ranges tab', 'error');
          return;
        }
        
        log('Step 3 passed: Saved ranges tab checked successfully', 'success');
        log('All tests passed! Availability preview feature is working correctly', 'success');
      }, 1000);
      
    } catch (error) {
      log(`Error during end-to-end test: ${error.message}`, 'error');
    }
  };
  
  // Add a test panel button
  const addTestPanel = () => {
    // Create container
    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.bottom = '20px';
    panel.style.right = '20px';
    panel.style.backgroundColor = 'white';
    panel.style.border = '1px solid #e2e8f0';
    panel.style.borderRadius = '8px';
    panel.style.padding = '16px';
    panel.style.zIndex = '9999';
    panel.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Availability Preview Tester';
    title.style.fontSize = '16px';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '12px';
    panel.appendChild(title);
    
    // Add test buttons
    const createButton = (text, callback) => {
      const button = document.createElement('button');
      button.textContent = text;
      button.style.padding = '8px 12px';
      button.style.margin = '4px';
      button.style.backgroundColor = '#3b82f6';
      button.style.color = 'white';
      button.style.border = 'none';
      button.style.borderRadius = '4px';
      button.style.cursor = 'pointer';
      button.addEventListener('click', callback);
      return button;
    };
    
    panel.appendChild(createButton('Open Preview', () => window.testOpenPreviewDialog()));
    panel.appendChild(createButton('Select Dates', () => window.testSelectDatesInPreview()));
    panel.appendChild(createButton('Check Saved Ranges', () => window.testSavedRangesTab()));
    panel.appendChild(createButton('Run All Tests', () => window.testAvailabilityPreviewFeature()));
    
    document.body.appendChild(panel);
    
    log('Test panel added to the page', 'success');
  };
  
  // Add the test panel after a short delay to ensure the page is loaded
  setTimeout(addTestPanel, 1000);
  
  log('Test script initialized! Use the following functions in the console:', 'success');
  log('window.testOpenPreviewDialog() - Test opening the preview dialog', 'info');
  log('window.testSelectDatesInPreview() - Test selecting dates in the preview', 'info');
  log('window.testSavedRangesTab() - Test the saved ranges tab', 'info');
  log('window.testAvailabilityPreviewFeature() - Run all tests in sequence', 'info');
})();