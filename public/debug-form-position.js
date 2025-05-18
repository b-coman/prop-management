// Debug script to test different form positions
// See documentation at: docs/guides/debugging-form-positions.md
// and docs/implementation/booking-form-positioning.md
(function() {
  console.group('Hero Form Position Testing');
  
  // Get the hero section
  const heroSection = document.querySelector('#hero');
  if (!heroSection) {
    console.log('Hero section not found');
    console.groupEnd();
    return;
  }
  
  // Get the current position
  const currentPosition = heroSection.getAttribute('data-form-position') || 'bottom';
  console.log(`Current form position: ${currentPosition}`);
  
  // Create a position selector
  // Define schema positions (from the Firestore schema) vs extended positions
  const schemaPositions = ['top', 'bottom', 'center'];
  const extendedPositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  
  // Build a simple UI
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed; bottom:10px; right:10px; background:white; padding:10px; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.1); z-index:9999; display:flex; flex-direction:column; font-family:system-ui;';
  
  const header = document.createElement('div');
  header.textContent = 'Form Position Tester';
  header.style.cssText = 'font-weight:bold; margin-bottom:8px; padding-bottom:4px; border-bottom:1px solid #eee;';
  container.appendChild(header);
  
  // Create schema positions section
  const schemaHeader = document.createElement('div');
  schemaHeader.textContent = 'Schema Positions (Supported in Firestore):';
  schemaHeader.style.cssText = 'font-size:12px; margin:4px 0; font-weight:500;';
  container.appendChild(schemaHeader);
  
  const schemaButtons = document.createElement('div');
  schemaButtons.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;';
  
  schemaPositions.forEach(position => {
    const button = document.createElement('button');
    button.textContent = position;
    button.style.cssText = `padding:4px 8px; border-radius:4px; cursor:pointer; 
                          background:${position === currentPosition ? '#e0f7fa' : '#f0f0f0'}; 
                          border:${position === currentPosition ? '1px solid #00bcd4' : 'none'};
                          font-weight:${position === currentPosition ? 'bold' : 'normal'};`;
    
    button.addEventListener('click', () => {
      // Update data attribute
      heroSection.setAttribute('data-form-position', position);
      console.log(`Changed position to schema position: ${position}`);
      
      // Update active button
      document.querySelectorAll('#position-tester button').forEach(btn => {
        btn.style.background = '#f0f0f0';
        btn.style.border = 'none';
        btn.style.fontWeight = 'normal';
      });
      button.style.background = '#e0f7fa';
      button.style.border = '1px solid #00bcd4';
      button.style.fontWeight = 'bold';
      
      // Force position recalculation by dispatching resize event
      window.dispatchEvent(new Event('resize'));
    });
    
    schemaButtons.appendChild(button);
  });
  
  container.appendChild(schemaButtons);
  
  // Create extended positions section
  const extendedHeader = document.createElement('div');
  extendedHeader.textContent = 'Extended Positions (Future Use):';
  extendedHeader.style.cssText = 'font-size:12px; margin:4px 0; font-weight:500;';
  container.appendChild(extendedHeader);
  
  const extendedButtons = document.createElement('div');
  extendedButtons.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;';
  
  extendedPositions.forEach(position => {
    const button = document.createElement('button');
    button.textContent = position;
    button.style.cssText = `padding:4px 8px; border-radius:4px; cursor:pointer; 
                          background:${position === currentPosition ? '#fff8e1' : '#f5f5f5'}; 
                          border:${position === currentPosition ? '1px solid #ffc107' : 'none'};
                          font-weight:${position === currentPosition ? 'bold' : 'normal'};
                          opacity:0.9;`; // Make extended options slightly less prominent
    
    button.addEventListener('click', () => {
      // Update data attribute
      heroSection.setAttribute('data-form-position', position);
      console.log(`Changed position to extended position: ${position}`);
      
      // Update active button
      document.querySelectorAll('#position-tester button').forEach(btn => {
        btn.style.background = '#f0f0f0';
        btn.style.border = 'none';
        btn.style.fontWeight = 'normal';
      });
      button.style.background = '#fff8e1';
      button.style.border = '1px solid #ffc107';
      button.style.fontWeight = 'bold';
      
      // Force position recalculation by dispatching resize event
      window.dispatchEvent(new Event('resize'));
    });
    
    extendedButtons.appendChild(button);
  });
  
  container.appendChild(extendedButtons);
  
  // Size toggle (compressed vs large)
  const sizeHeader = document.createElement('div');
  sizeHeader.textContent = 'Form Size:';
  sizeHeader.style.cssText = 'font-size:12px; margin:4px 0; font-weight:500;';
  container.appendChild(sizeHeader);
  
  const currentSize = heroSection.getAttribute('data-form-size') || 'compressed';
  const sizeButtons = document.createElement('div');
  sizeButtons.style.cssText = 'display:flex; gap:4px; margin-bottom:8px;';
  
  ['compressed', 'large'].forEach(size => {
    const button = document.createElement('button');
    button.textContent = size;
    button.style.cssText = `padding:4px 8px; border-radius:4px; cursor:pointer; 
                          flex:1;
                          background:${size === currentSize ? '#e8f5e9' : '#f0f0f0'}; 
                          border:${size === currentSize ? '1px solid #4caf50' : 'none'};
                          font-weight:${size === currentSize ? 'bold' : 'normal'};`;
    
    button.addEventListener('click', () => {
      // Update size attribute
      heroSection.setAttribute('data-form-size', size);
      console.log(`Changed form size to: ${size}`);
      
      // Update active button styling
      const sizeButtons = document.querySelectorAll('#position-tester .size-button');
      sizeButtons.forEach(btn => {
        btn.style.background = '#f0f0f0';
        btn.style.border = 'none';
        btn.style.fontWeight = 'normal';
      });
      button.style.background = '#e8f5e9';
      button.style.border = '1px solid #4caf50';
      button.style.fontWeight = 'bold';
      
      // Reload the page to apply the size change
      // This is needed because size affects component props which need re-rendering
      if (confirm('Changing size requires page reload. Reload now?')) {
        window.location.reload();
      }
    });
    
    button.classList.add('size-button');
    sizeButtons.appendChild(button);
  });
  
  container.appendChild(sizeButtons);
  
  // Close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.cssText = 'margin-top:8px; padding:4px; background:#f44336; color:white; border:none; border-radius:4px;';
  closeButton.addEventListener('click', () => {
    document.body.removeChild(container);
  });
  container.appendChild(closeButton);
  
  container.id = 'position-tester';
  document.body.appendChild(container);
  
  console.log('Position tester initialized. Use the buttons to test different form positions.');
  console.log('- Schema positions are fully supported in the Firestore configuration');
  console.log('- Extended positions are supported by the code but not in the current schema');
  console.groupEnd();
})();