// Debug script to check for duplicate elements
(function() {
  console.group('Layout Structure Analysis');
  
  // Check for duplicate header elements
  const headers = document.querySelectorAll('header');
  console.log(`Found ${headers.length} header elements:`, headers);
  
  if (headers.length > 1) {
    console.warn('Multiple header elements detected!');
    headers.forEach((header, i) => {
      console.log(`Header #${i+1} parent:`, header.parentElement);
      console.log(`Header #${i+1} innerHTML preview:`, header.innerHTML.substring(0, 200) + '...');
    });
  }
  
  // Check for main elements
  const mains = document.querySelectorAll('main');
  console.log(`Found ${mains.length} main elements:`, mains);
  
  // Check for containers that might be duplicated
  const headerContainers = document.querySelectorAll('#header-container');
  console.log(`Found ${headerContainers.length} #header-container elements:`, headerContainers);
  
  // Check first block elements
  const firstBlocks = document.querySelectorAll('.first-block');
  console.log(`Found ${firstBlocks.length} .first-block elements:`, firstBlocks);
  
  // Log DOM hierarchy for analysis
  console.log('DOM Hierarchy from body:');
  const simplifyNode = (node) => {
    if (node.nodeType === 3) return; // Skip text nodes
    let result = {
      tagName: node.tagName,
      id: node.id || undefined,
      classes: node.className ? Array.from(node.classList) : undefined,
      children: []
    };
    
    if (node.childNodes.length > 0) {
      Array.from(node.childNodes)
        .filter(child => child.nodeType === 1) // Only element nodes
        .forEach(child => {
          const simplified = simplifyNode(child);
          if (simplified) result.children.push(simplified);
        });
    }
    
    return result;
  };
  
  console.log(simplifyNode(document.body));
  
  console.groupEnd();
})();