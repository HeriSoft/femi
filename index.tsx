import React from 'react';
import ReactDOM from 'react-dom/client';
import { RootAppWrapper } from './App.tsx'; // Changed to named import

console.log("[index.tsx] Script start. React version available:", React.version);
console.log("[index.tsx] ReactDOM available:", ReactDOM);

const rootElement = document.getElementById('root');
console.log("[index.tsx] Root element (should be a div with id='root'):", rootElement);

if (!rootElement) {
  const errorMsg = "CRITICAL ERROR: Root element with ID 'root' was not found in the DOM. React cannot mount. Please check your index.html file to ensure it contains a <div id=\"root\"></div> element in the body.";
  console.error(errorMsg);
  // Display error directly on the page for better visibility
  const errorDiv = document.createElement('div');
  errorDiv.textContent = errorMsg;
  errorDiv.style.color = "red";
  errorDiv.style.fontSize = "20px";
  errorDiv.style.padding = "20px";
  errorDiv.style.fontFamily = "monospace";
  errorDiv.style.border = "2px solid red";
  errorDiv.style.backgroundColor = "#fff0f0";
  document.body.prepend(errorDiv);
} else {
  try {
    console.log("[index.tsx] Attempting to create React root on element:", rootElement);
    const root = ReactDOM.createRoot(rootElement);
    console.log("[index.tsx] React root created successfully.");
    console.log("[index.tsx] Attempting to render <App /> component into the React root...");
    root.render(
      <React.StrictMode>
        <RootAppWrapper />
      </React.StrictMode>
    );
    console.log("[index.tsx] <App /> component has been passed to root.render(). If the page is still blank, check for errors within App or its children, or issues with async operations.");
  } catch (e) {
    let errorMsg = "CRITICAL ERROR during React root creation or initial render: ";
    if (e instanceof Error) {
      errorMsg += e.message;
    } else {
      errorMsg += String(e);
    }
    
    console.error(errorMsg, e); // Log the full error object as well

    // Display error directly on the page for better visibility
    const errorDisplayDiv = document.createElement('div');
    errorDisplayDiv.style.color = "red";
    errorDisplayDiv.style.fontSize = "16px";
    errorDisplayDiv.style.padding = "20px";
    errorDisplayDiv.style.fontFamily = "monospace";
    errorDisplayDiv.style.backgroundColor = "#fff0f0";
    errorDisplayDiv.style.border = "2px solid red";
    errorDisplayDiv.style.margin = "10px";
    
    const title = document.createElement('h3');
    title.textContent = "Application Error";
    errorDisplayDiv.appendChild(title);

    const messageParagraph = document.createElement('p');
    messageParagraph.textContent = errorMsg;
    errorDisplayDiv.appendChild(messageParagraph);

    if (e instanceof Error && e.stack) {
        const stackTitle = document.createElement('h4');
        stackTitle.textContent = "Stack Trace:";
        stackTitle.style.marginTop = "10px";
        errorDisplayDiv.appendChild(stackTitle);
        
        const stackPre = document.createElement('pre');
        stackPre.textContent = e.stack;
        stackPre.style.marginTop = '5px';
        stackPre.style.padding = '10px';
        stackPre.style.border = '1px solid #ffcccc';
        stackPre.style.backgroundColor = '#fff5f5';
        stackPre.style.whiteSpace = 'pre-wrap'; // Ensure stack trace wraps
        stackPre.style.wordBreak = 'break-all'; // Ensure long lines break
        errorDisplayDiv.appendChild(stackPre);
    }
    document.body.prepend(errorDisplayDiv);
  }
}
console.log("[index.tsx] Script end, all content processed."); // Added diagnostic log